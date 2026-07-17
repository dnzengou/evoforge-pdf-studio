// Smoke: build a 2-page PDF, run the full export pipeline with every
// annotation kind + rotation + page surgery, verify structure survives.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { exportPdf } from '../src/lib/exportPdf'
import { summarize, keywords, PII_PATTERNS } from '../src/lib/aiTools'
import type { Annotation, PageMeta } from '../src/types'

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`ok — ${msg}`)
}

const src = await PDFDocument.create()
const font = await src.embedFont(StandardFonts.Helvetica)
for (let i = 0; i < 2; i++) {
  const page = src.addPage([612, 792])
  page.drawText(
    `Page ${i + 1}. Contact alice@example.com or call 555-123-4567. SSN 123-45-6789. ` +
      'The quarterly report shows revenue growth across all regions. ' +
      'Margins improved as costs fell. The outlook remains positive for the next fiscal year. '.repeat(
        8,
      ),
    { x: 40, y: 700, size: 10, font, color: rgb(0, 0, 0), maxWidth: 520, lineHeight: 13 },
  )
}
const srcBytes = (await src.save()).buffer as ArrayBuffer

const pages: PageMeta[] = [
  { id: 'p1', srcId: 'main', srcIndex: 0, rotation: 90 },
  { id: 'blank', srcId: '__blank__', srcIndex: 0, rotation: 0 },
]

// 1x1 transparent PNG for the image annotation path.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const anns: Annotation[] = [
  { id: 'a1', kind: 'pen', points: [{ x: 10, y: 10 }, { x: 100, y: 80 }, { x: 200, y: 20 }], color: '#e11d48', width: 2.5, opacity: 1 },
  { id: 'a2', kind: 'highlight', points: [{ x: 40, y: 700 }, { x: 300, y: 700 }], color: '#facc15', width: 16, opacity: 0.35 },
  { id: 'a3', kind: 'text', x: 50, y: 500, w: 300, text: 'Signed — Evoforge\nLine two', color: '#2563eb', fontSize: 14 },
  { id: 'a4', kind: 'rect', x: 60, y: 600, w: 120, h: 60, color: '#16a34a', width: 2, fill: true },
  { id: 'a5', kind: 'ellipse', x: 200, y: 600, w: 120, h: 60, color: '#7c3aed', width: 2, fill: false },
  { id: 'a6', kind: 'line', a: { x: 0, y: 0 }, b: { x: 300, y: 300 }, color: '#000000', width: 1.5 },
  { id: 'a7', kind: 'arrow', a: { x: 300, y: 300 }, b: { x: 400, y: 400 }, color: '#e11d48', width: 2 },
  { id: 'a8', kind: 'redact', x: 40, y: 690, w: 150, h: 14 },
  { id: 'a9', kind: 'image', x: 350, y: 100, w: 120, h: 60, dataUrl: PNG_1PX },
]

for (const rot of [0, 90, 180, 270]) {
  const out = await exportPdf(
    { main: srcBytes },
    pages.map((p) => ({ ...p, rotation: rot })),
    { p1: anns, blank: anns },
  )
  const doc = await PDFDocument.load(out)
  assert(doc.getPageCount() === 2, `export rot=${rot}: page count 2 (deleted src page 2, added blank)`)
  const angle = doc.getPage(0).getRotation().angle
  assert(angle === rot, `export rot=${rot}: rotation applied (${angle})`)
}

// Free-plan watermark burns into output; premium omits it.
const wm = await exportPdf({ main: srcBytes }, [pages[0]], {}, { watermark: 'Made with Evoforge PDF — free plan' })
const wmDoc = await PDFDocument.load(wm)
assert(wmDoc.getPageCount() === 1, 'watermarked export loads')
const clean = await exportPdf({ main: srcBytes }, [pages[0]], {})
assert(clean.byteLength !== wm.byteLength, 'premium export differs from watermarked export')

// Unicode must not crash export — falls back to '?'.
const uniOut = await exportPdf({ main: srcBytes }, [pages[0]], {
  p1: [{ ...anns[2], id: 'u1', text: '中文注释 café ✓' }],
})
assert((await PDFDocument.load(uniOut)).getPageCount() === 1, 'unicode text annotation survives export')

// aiTools on known text.
const text =
  'Revenue grew this year. The quarterly report shows revenue growth across all regions. ' +
  'Costs fell sharply. Margins improved as costs fell. The outlook remains positive. ' +
  'Investors welcomed the news. Growth should continue next year. alice@example.com 123-45-6789'
const lines = summarize(text, 3)
assert(lines.length === 3 && lines.every((l) => l.length > 30), `summarize returns ${lines.length} ordered key sentences`)
assert(keywords(text, 5).includes('revenue') || keywords(text, 5).includes('growth'), 'keywords surface topic terms')
const piiKinds = PII_PATTERNS.filter(({ pattern }) => {
  pattern.lastIndex = 0
  return pattern.test(text)
}).map((p) => p.kind)
assert(piiKinds.includes('Email') && piiKinds.includes('SSN'), `PII patterns hit: ${piiKinds.join(', ')}`)

console.log('\nALL SMOKE TESTS PASSED')
