import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type LoadedDoc = {
  doc: pdfjs.PDFDocumentProxy
  numPages: number
}

const docCache = new Map<string, Promise<LoadedDoc>>()

export function loadDoc(srcId: string, bytes?: ArrayBuffer): Promise<LoadedDoc> {
  let cached = docCache.get(srcId)
  if (!cached) {
    if (!bytes) throw new Error(`doc ${srcId} not loaded yet`)
    cached = pdfjs.getDocument({ data: bytes.slice(0) }).promise.then((doc) => ({
      doc,
      numPages: doc.numPages,
    }))
    docCache.set(srcId, cached)
  }
  return cached
}

// Display-space size after user rotation: width/height swap on odd quarter turns.
// rotation param is the USER delta; total = intrinsic + delta, matching export.
async function viewport(
  srcId: string,
  srcIndex: number,
  rotation: number,
  scale: number,
) {
  const { doc } = await loadDoc(srcId)
  const page = await doc.getPage(srcIndex + 1)
  const total = (((page.rotate + rotation) % 360) + 360) % 360
  return { page, vp: page.getViewport({ scale, rotation: total }) }
}

export async function displaySize(
  srcId: string,
  srcIndex: number,
  rotation: number,
): Promise<{ w: number; h: number }> {
  const { vp } = await viewport(srcId, srcIndex, rotation, 1)
  return { w: vp.width, h: vp.height }
}

export async function renderPage(
  srcId: string,
  srcIndex: number,
  rotation: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const { page, vp } = await viewport(srcId, srcIndex, rotation, scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = Math.floor(vp.width)
  const h = Math.floor(vp.height)
  // Render offscreen, then blit: pdfjs forbids concurrent renders on one canvas,
  // and fast zoom changes would otherwise throw mid-frame.
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const offCtx = off.getContext('2d')
  if (!offCtx) return
  await page.render({ canvasContext: offCtx, viewport: vp, canvas: off }).promise
  canvas.width = w
  canvas.height = h
  ctx.drawImage(off, 0, 0)
}

export async function pageText(srcId: string, srcIndex: number): Promise<string> {
  const { doc } = await loadDoc(srcId)
  const page = await doc.getPage(srcIndex + 1)
  const content = await page.getTextContent()
  return content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rects in display space for regex matches on a page; used by the PII scanner.
export async function matchRects(
  srcId: string,
  srcIndex: number,
  rotation: number,
  pattern: RegExp,
): Promise<{ value: string; rect: { x: number; y: number; w: number; h: number } }[]> {
  const { page, vp } = await viewport(srcId, srcIndex, rotation, 1)
  const content = await page.getTextContent()
  const hits: { value: string; rect: { x: number; y: number; w: number; h: number } }[] = []
  for (const item of content.items) {
    if (!('str' in item)) continue
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(item.str))) {
      const frac = m.index / Math.max(item.str.length, 1)
      const fracW = m[0].length / Math.max(item.str.length, 1)
      // Item transform → viewport box; match width approximated by char share.
      const tx = pdfjs.Util.transform(vp.transform, item.transform)
      const x = tx[4] + item.width * frac * vp.scale
      const w = item.width * fracW * vp.scale
      const fontH = Math.hypot(tx[2], tx[3]) || item.height * vp.scale
      const yTop = tx[5] - fontH
      hits.push({
        value: m[0],
        rect: { x, y: vp.height - yTop - fontH, w: Math.max(w, 4), h: fontH * 1.2 },
      })
    }
  }
  return hits
}

export type WidgetInfo = { name: string; fieldType: string }

export async function formFields(srcId: string, srcIndex: number): Promise<WidgetInfo[]> {
  const { doc } = await loadDoc(srcId)
  const page = await doc.getPage(srcIndex + 1)
  const annots = await page.getAnnotations()
  return annots
    .filter((a) => a.subtype === 'Widget')
    .map((a) => ({
      name: (a as { fieldName?: string }).fieldName ?? '(unnamed)',
      fieldType: (a as { fieldType?: string }).fieldType ?? '?',
    }))
}
