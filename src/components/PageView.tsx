import { useCallback, useEffect, useRef, useState } from 'react'
import { displaySize, renderPage } from '@/lib/pdfEngine'
import { useEditor, BLANK_SRC } from '@/store'
import type { Annotation, PageMeta, Point } from '@/types'
import { uid } from '@/types'
import { AnnotationSvg, annBounds, moveBy, remapToBox } from './AnnotationSvg'

type StrokeAnn = Extract<Annotation, { kind: 'pen' | 'highlight' }>

type Drag =
  | { mode: 'draw'; ann: StrokeAnn }
  | { mode: 'shape'; start: Point; cur: Point }
  | { mode: 'move'; ann: Annotation; last: Point }
  | { mode: 'resize'; ann: Annotation; from: { x: number; y: number; w: number; h: number }; corner: string }

type Props = {
  meta: PageMeta
  index: number
  scale: number
  editingText: { pageId: string; x: number; y: number; annId?: string; value: string } | null
  setEditingText: (v: Props['editingText']) => void
}

const normRect = (a: Point, b: Point) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
})

export function PageView({ meta, index, scale, editingText, setEditingText }: Props) {
  const { srcDocs, annotations, tool, color, width, fontSize, selectedId, pendingStamp } =
    useEditor()
  const store = useEditor.getState
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const dragRef = useRef<Drag | null>(null)
  const [, force] = useState(0)

  const anns = annotations[meta.id] ?? []

  useEffect(() => {
    let live = true
    if (meta.srcId === BLANK_SRC) {
      setSize({ w: 612, h: 792 })
      return
    }
    displaySize(meta.srcId, meta.srcIndex, meta.rotation).then((s) => {
      if (live) setSize(s)
    })
    return () => {
      live = false
    }
  }, [meta.srcId, meta.srcIndex, meta.rotation, srcDocs])

  // Lazy-render: only rasterize pages near the viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { rootMargin: '800px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !size || meta.srcId === BLANK_SRC) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const run = async () => {
      await renderPage(meta.srcId, meta.srcIndex, meta.rotation, scale * dpr, canvas)
      if (cancelled) return
      canvas.style.width = `${size.w * scale}px`
      canvas.style.height = `${size.h * scale}px`
    }
    run().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [visible, size, scale, meta, srcDocs])

  // Convert a pointer event to PDF display points (origin bottom-left).
  const toPdf = useCallback(
    (e: React.PointerEvent): Point => {
      const rect = wrapRef.current!.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const yCss = (e.clientY - rect.top) / scale
      return { x, y: (size?.h ?? 0) - yCss }
    },
    [scale, size],
  )

  const placeStamp = (p: Point, dataUrl: string) => {
    const img = new Image()
    img.onload = () => {
      const w = 180
      const h = (img.height / img.width) * w
      store().commit()
      store().addAnnotation(meta.id, {
        id: uid(),
        kind: 'image',
        x: p.x - w / 2,
        y: p.y - h / 2,
        w,
        h,
        dataUrl,
      })
      store().setPendingStamp(null)
    }
    img.src = dataUrl
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (editingText) return
    const p = toPdf(e)
    if (pendingStamp && (tool === 'signature' || tool === 'image')) {
      placeStamp(p, pendingStamp)
      return
    }
    switch (tool) {
      case 'pen':
      case 'highlight': {
        const ann: StrokeAnn = {
          id: uid(),
          kind: tool,
          points: [p],
          color: tool === 'highlight' ? '#facc15' : color,
          width: tool === 'highlight' ? 16 : width,
          opacity: tool === 'highlight' ? 0.35 : 1,
        }
        store().commit()
        store().addAnnotation(meta.id, ann)
        dragRef.current = { mode: 'draw', ann }
        break
      }
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arrow':
      case 'redact': {
        store().commit()
        dragRef.current = { mode: 'shape', start: p, cur: p }
        break
      }
      case 'text': {
        setEditingText({ pageId: meta.id, x: p.x, y: p.y, value: '' })
        break
      }
      case 'eraser': {
        const hit = hitTest(p, anns)
        if (hit) {
          store().commit()
          store().removeAnnotation(meta.id, hit.id)
        }
        break
      }
      case 'select': {
        store().select(null)
        break
      }
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onAnnPointerDown = (e: React.PointerEvent, ann: Annotation) => {
    if (tool === 'eraser') {
      e.stopPropagation()
      store().commit()
      store().removeAnnotation(meta.id, ann.id)
      return
    }
    if (tool !== 'select') return
    e.stopPropagation()
    store().select(ann.id)
    store().commit()
    dragRef.current = { mode: 'move', ann, last: toPdf(e) }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onHandleDown = (e: React.PointerEvent, ann: Annotation, corner: string) => {
    e.stopPropagation()
    store().commit()
    dragRef.current = { mode: 'resize', ann, from: annBounds(ann), corner }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !size) return
    const p = toPdf(e)
    if (drag.mode === 'draw') {
      const pts = [...drag.ann.points]
      const last = pts[pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return
      pts.push(p)
      drag.ann = { ...drag.ann, points: pts } as StrokeAnn
      store().updateAnnotation(meta.id, drag.ann)
    } else if (drag.mode === 'shape') {
      drag.cur = p
      force((n) => n + 1)
    } else if (drag.mode === 'move') {
      const dx = p.x - drag.last.x
      const dy = p.y - drag.last.y
      drag.ann = moveBy(drag.ann, dx, dy)
      drag.last = p
      store().updateAnnotation(meta.id, drag.ann)
    } else if (drag.mode === 'resize') {
      const box = { ...drag.from }
      if (drag.corner.includes('e')) box.w = Math.max(8, p.x - box.x)
      if (drag.corner.includes('w')) {
        const newX = Math.min(p.x, box.x + box.w - 8)
        box.w = box.x + box.w - newX
        box.x = newX
      }
      if (drag.corner.includes('n')) box.h = Math.max(8, p.y - box.y)
      if (drag.corner.includes('s')) {
        const newY = Math.min(p.y, box.y + box.h - 8)
        box.h = box.y + box.h - newY
        box.y = newY
      }
      drag.ann = remapToBox(drag.ann, drag.from, box)
      store().updateAnnotation(meta.id, drag.ann)
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    if (!drag || !size) return
    dragRef.current = null
    if (drag.mode === 'shape') {
      const r = normRect(drag.start, drag.cur)
      if (r.w < 3 && r.h < 3 && tool !== 'line' && tool !== 'arrow') return
      const common = { id: uid(), color }
      let ann: Annotation | null = null
      if (tool === 'rect') ann = { ...common, kind: 'rect', ...r, width, fill: false }
      if (tool === 'ellipse') ann = { ...common, kind: 'ellipse', ...r, width, fill: false }
      if (tool === 'redact') ann = { id: uid(), kind: 'redact', ...r }
      if (tool === 'line') ann = { ...common, kind: 'line', a: drag.start, b: drag.cur, width }
      if (tool === 'arrow') ann = { ...common, kind: 'arrow', a: drag.start, b: drag.cur, width }
      if (ann) store().addAnnotation(meta.id, ann)
    }
  }

  const selected = anns.find((a) => a.id === selectedId)

  if (!size) {
    return <div ref={wrapRef} className="mx-auto my-4 h-[900px] w-[700px] animate-pulse rounded bg-zinc-800" />
  }

  const fl = (y: number) => size.h - y
  const preview =
    dragRef.current?.mode === 'shape' ? normRect(dragRef.current.start, dragRef.current.cur) : null

  return (
    <div
      ref={wrapRef}
      data-page-index={index}
      className="relative mx-auto my-3 select-none bg-white shadow-lg shadow-black/40"
      style={{ width: size.w * scale, height: size.h * scale }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <svg
        className="absolute inset-0"
        width={size.w * scale}
        height={size.h * scale}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{
          cursor:
            tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
        }}
      >
        {anns.map((ann) => (
          <AnnotationSvg
            key={ann.id}
            ann={ann}
            pageH={size.h}
            interactive={tool === 'select' || tool === 'eraser'}
            onPointerDown={onAnnPointerDown}
          />
        ))}
        {preview && tool !== 'line' && tool !== 'arrow' && (
          <rect
            x={preview.x}
            y={fl(preview.y + preview.h)}
            width={preview.w}
            height={preview.h}
            fill={tool === 'redact' ? '#000' : 'none'}
            stroke={tool === 'redact' ? '#000' : color}
            strokeDasharray="4 3"
            strokeWidth={tool === 'redact' ? 0 : width}
          />
        )}
        {preview == null && dragRef.current?.mode === 'shape' && (tool === 'line' || tool === 'arrow') && (
          <line
            x1={dragRef.current.start.x}
            y1={fl(dragRef.current.start.y)}
            x2={dragRef.current.cur.x}
            y2={fl(dragRef.current.cur.y)}
            stroke={color}
            strokeWidth={width}
            strokeDasharray="4 3"
          />
        )}
        {selected && tool === 'select' && (
          <SelectionBox ann={selected} pageH={size.h} onHandleDown={onHandleDown} />
        )}
      </svg>
      {editingText?.pageId === meta.id && (
        <TextEditor
          x={editingText.x * scale}
          y={(size.h - editingText.y) * scale}
          initial={editingText.value}
          color={color}
          fontSize={fontSize * scale}
          onCommit={(value) => {
            if (value.trim()) {
              store().commit()
              const textAnn: Annotation = {
                id: editingText.annId ?? uid(),
                kind: 'text',
                x: editingText.x,
                y: editingText.y,
                w: 300,
                text: value,
                color,
                fontSize,
              }
              if (editingText.annId) store().updateAnnotation(meta.id, textAnn)
              else store().addAnnotation(meta.id, textAnn)
            }
            setEditingText(null)
          }}
          onCancel={() => setEditingText(null)}
        />
      )}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500">
        {index + 1}
      </div>
    </div>
  )
}

function hitTest(p: Point, anns: Annotation[]): Annotation | null {
  for (let i = anns.length - 1; i >= 0; i--) {
    const b = annBounds(anns[i])
    const pad = 4
    if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) {
      return anns[i]
    }
  }
  return null
}

function SelectionBox({
  ann,
  pageH,
  onHandleDown,
}: {
  ann: Annotation
  pageH: number
  onHandleDown: (e: React.PointerEvent, ann: Annotation, corner: string) => void
}) {
  const b = annBounds(ann)
  const y = pageH - b.y - b.h
  const corners: { id: string; cx: number; cy: number }[] = [
    { id: 'nw', cx: b.x, cy: y },
    { id: 'ne', cx: b.x + b.w, cy: y },
    { id: 'sw', cx: b.x, cy: y + b.h },
    { id: 'se', cx: b.x + b.w, cy: y + b.h },
  ]
  return (
    <g>
      <rect
        x={b.x}
        y={y}
        width={b.w}
        height={b.h}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="5 3"
      />
      {corners.map((c) => (
        <rect
          key={c.id}
          x={c.cx - 4}
          y={c.cy - 4}
          width={8}
          height={8}
          fill="#fff"
          stroke="#38bdf8"
          strokeWidth={1.5}
          style={{ cursor: `${c.id}-resize` }}
          onPointerDown={(e) => onHandleDown(e, ann, c.id)}
        />
      ))}
    </g>
  )
}

function TextEditor({
  x,
  y,
  initial,
  color,
  fontSize,
  onCommit,
  onCancel,
}: {
  x: number
  y: number
  initial: string
  color: string
  fontSize: number
  onCommit: (v: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      className="absolute z-10 min-w-[120px] resize border border-sky-400 bg-white/95 p-1 outline-none"
      style={{ left: x, top: y, color, fontSize, lineHeight: 1.2 }}
      rows={Math.max(2, initial.split('\n').length)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onCommit((e.target as HTMLTextAreaElement).value)
        }
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={(e) => onCommit(e.target.value)}
    />
  )
}
