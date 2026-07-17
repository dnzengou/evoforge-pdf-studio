import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { Annotation, PageMeta, Point } from '@/types'

type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Map a display-space point (after user rotation) back to the page's raw
// user space so pdf-lib draws it where the user sees it. raw = unrotated dims.
function toRaw(p: Point, rotation: number, rawW: number, rawH: number): Point {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return { x: rawW - p.y, y: p.x }
    case 180:
      return { x: rawW - p.x, y: rawH - p.y }
    case 270:
      return { x: p.y, y: rawH - p.x }
    default:
      return p
  }
}

function toRawRect(
  r: { x: number; y: number; w: number; h: number },
  rotation: number,
  rawW: number,
  rawH: number,
): { x: number; y: number; w: number; h: number } {
  const corners = [
    toRaw({ x: r.x, y: r.y }, rotation, rawW, rawH),
    toRaw({ x: r.x + r.w, y: r.y + r.h }, rotation, rawW, rawH),
  ]
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  }
}

// Helvetica is WinAnsi-only; replace chars it cannot encode instead of throwing.
function winAnsiSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63
    out += code <= 255 ? ch : '?'
  }
  return out
}

async function embedAny(doc: PDFDocument, dataUrl: string) {
  const base64 = dataUrl.split(',')[1]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return dataUrl.startsWith('data:image/jpeg') ? doc.embedJpg(bytes) : doc.embedPng(bytes)
}

function drawOne(
  docPage: import('pdf-lib').PDFPage,
  ann: Annotation,
  rotation: number,
  rawW: number,
  rawH: number,
  font: import('pdf-lib').PDFFont,
  embedded: Map<string, import('pdf-lib').PDFImage>,
  doc: PDFDocument,
): Promise<void> {
  return (async () => {
    const colorOf = (hex: string, opacity = 1) => {
      const [r, g, b] = hexToRgb(hex)
      return { color: rgb(r, g, b), opacity }
    }
    switch (ann.kind) {
      case 'pen': {
        const pts = ann.points.map((p) => toRaw(p, rotation, rawW, rawH))
        for (let i = 1; i < pts.length; i++) {
          docPage.drawLine({
            start: pts[i - 1],
            end: pts[i],
            thickness: ann.width,
            lineCap: 1,
            ...colorOf(ann.color, ann.opacity),
          })
        }
        break
      }
      case 'highlight': {
        const pts = ann.points.map((p) => toRaw(p, rotation, rawW, rawH))
        for (let i = 1; i < pts.length; i++) {
          docPage.drawLine({
            start: pts[i - 1],
            end: pts[i],
            thickness: ann.width,
            lineCap: 1,
            ...colorOf(ann.color, ann.opacity),
          })
        }
        break
      }
      case 'text': {
        const size = ann.fontSize
        const lines = winAnsiSafe(ann.text).split('\n')
        lines.forEach((line, i) => {
          const p = toRaw(
            { x: ann.x, y: ann.y - i * size * 1.2 - size },
            rotation,
            rawW,
            rawH,
          )
          // Counter-rotate glyphs so text reads upright after page /Rotate.
          docPage.drawText(line, {
            x: p.x,
            y: p.y,
            size,
            font,
            rotate: degrees(rotation),
            ...colorOf(ann.color),
          })
        })
        break
      }
      case 'rect': {
        const r = toRawRect(ann, rotation, rawW, rawH)
        docPage.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          borderWidth: ann.width,
          ...(ann.fill ? colorOf(ann.color, 0.35) : {}),
          ...{ borderColor: rgb(...hexToRgb(ann.color)) },
        })
        break
      }
      case 'ellipse': {
        const r = toRawRect(ann, rotation, rawW, rawH)
        docPage.drawEllipse({
          x: r.x + r.w / 2,
          y: r.y + r.h / 2,
          xScale: r.w / 2,
          yScale: r.h / 2,
          borderWidth: ann.width,
          ...(ann.fill ? colorOf(ann.color, 0.35) : {}),
          ...{ borderColor: rgb(...hexToRgb(ann.color)) },
        })
        break
      }
      case 'line': {
        const a = toRaw(ann.a, rotation, rawW, rawH)
        const b = toRaw(ann.b, rotation, rawW, rawH)
        docPage.drawLine({ start: a, end: b, thickness: ann.width, ...colorOf(ann.color) })
        break
      }
      case 'arrow': {
        const a = toRaw(ann.a, rotation, rawW, rawH)
        const b = toRaw(ann.b, rotation, rawW, rawH)
        docPage.drawLine({ start: a, end: b, thickness: ann.width, ...colorOf(ann.color) })
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const headLen = Math.max(8, ann.width * 3)
        for (const s of [1, -1]) {
          const ha = angle + s * 0.45
          docPage.drawLine({
            start: b,
            end: { x: b.x - headLen * Math.cos(ha), y: b.y - headLen * Math.sin(ha) },
            thickness: ann.width,
            ...colorOf(ann.color),
          })
        }
        break
      }
      case 'redact': {
        const r = toRawRect(ann, rotation, rawW, rawH)
        docPage.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(0, 0, 0) })
        break
      }
      case 'image': {
        let img = embedded.get(ann.id)
        if (!img) {
          img = await embedAny(doc, ann.dataUrl)
          embedded.set(ann.id, img)
        }
        const r = toRawRect(ann, rotation, rawW, rawH)
        docPage.drawImage(img, { x: r.x, y: r.y, width: r.w, height: r.h })
        break
      }
    }
  })()
}

export async function exportPdf(
  srcDocs: Record<string, ArrayBuffer>,
  pages: PageMeta[],
  annotations: Record<string, Annotation[]>,
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const embedded = new Map<string, import('pdf-lib').PDFImage>()
  const sources = new Map<string, PDFDocument>()
  for (const [srcId, bytes] of Object.entries(srcDocs)) {
    sources.set(srcId, await PDFDocument.load(bytes.slice(0), { ignoreEncryption: true }))
  }
  for (const meta of pages) {
    const src = sources.get(meta.srcId)
    const copied = src
      ? (await out.copyPages(src, [meta.srcIndex]))[0]
      : out.addPage([612, 792]) // blank page, US Letter
    const { width: rawW, height: rawH } = copied.getSize()
    const rot = (((copied.getRotation().angle + meta.rotation) % 360) + 360) % 360
    copied.setRotation(degrees(rot))
    // pdf-lib drawing ignores /Rotate, so annotate against raw dims, pre-rotation.
    copied.setRotation(degrees(0))
    for (const ann of annotations[meta.id] ?? []) {
      await drawOne(copied, ann, rot, rawW, rawH, font, embedded, out)
    }
    copied.setRotation(degrees(rot))
    if (src) out.addPage(copied)
  }
  return out.save()
}
