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

export type Rect = { x: number; y: number; w: number; h: number }
export type MatchHit = { value: string; rects: Rect[] }

// Rects in display space for regex matches on a page; used by the PII scanner.
// pdf.js splits page text into runs at font/kerning boundaries — a phone number
// like "555-123-4567" can arrive as ["555-", "123-4567"] and per-run matching
// would silently miss the split versions. We concatenate all runs into a flat
// string, run the regex globally, then map each match back to per-run rects via
// running offsets. Empty separator is deliberate: several PII patterns (Email,
// SSN, IBAN, IP) disallow whitespace, so any inserted separator would defeat
// the fix for those.
export async function matchRects(
  srcId: string,
  srcIndex: number,
  rotation: number,
  pattern: RegExp,
): Promise<MatchHit[]> {
  const { page, vp } = await viewport(srcId, srcIndex, rotation, 1)
  const content = await page.getTextContent()
  type Run = {
    str: string
    transform: number[]
    width: number
    height: number
    start: number
    end: number
  }
  const runs: Run[] = []
  let flat = ''
  for (const item of content.items) {
    if (!('str' in item)) continue
    const start = flat.length
    flat += item.str
    runs.push({
      str: item.str,
      transform: item.transform,
      width: item.width,
      height: item.height,
      start,
      end: flat.length,
    })
  }
  const hits: MatchHit[] = []
  pattern.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(flat))) {
    const mStart = m.index
    const mEnd = mStart + m[0].length
    const rects: Rect[] = []
    for (const run of runs) {
      if (run.end <= mStart) continue
      if (run.start >= mEnd) break
      const localStart = Math.max(mStart, run.start) - run.start
      const localEnd = Math.min(mEnd, run.end) - run.start
      const itemLen = Math.max(run.str.length, 1)
      const frac = localStart / itemLen
      const fracW = (localEnd - localStart) / itemLen
      // Item transform → viewport box; match width approximated by char share.
      const tx = pdfjs.Util.transform(vp.transform, run.transform)
      const x = tx[4] + run.width * frac * vp.scale
      const w = run.width * fracW * vp.scale
      const fontH = Math.hypot(tx[2], tx[3]) || run.height * vp.scale
      const yTop = tx[5] - fontH
      rects.push({ x, y: vp.height - yTop - fontH, w: Math.max(w, 4), h: fontH * 1.2 })
    }
    if (rects.length > 0) hits.push({ value: m[0], rects })
    // Guard against zero-width matches that would loop forever.
    if (m[0].length === 0) pattern.lastIndex++
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
