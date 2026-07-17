import type { Annotation, Point } from '@/types'

export function annBounds(ann: Annotation): { x: number; y: number; w: number; h: number } {
  switch (ann.kind) {
    case 'pen':
    case 'highlight': {
      const xs = ann.points.map((p) => p.x)
      const ys = ann.points.map((p) => p.y)
      const pad = ann.width / 2
      const x = Math.min(...xs) - pad
      const y = Math.min(...ys) - pad
      return {
        x,
        y,
        w: Math.max(...xs) - x + pad,
        h: Math.max(...ys) - y + pad,
      }
    }
    case 'text':
      return { x: ann.x, y: ann.y - ann.fontSize * 1.2 * ann.text.split('\n').length, w: ann.w, h: ann.fontSize * 1.2 * ann.text.split('\n').length }
    case 'rect':
    case 'ellipse':
    case 'redact':
    case 'image':
      return { x: ann.x, y: ann.y, w: ann.w, h: ann.h }
    case 'line':
    case 'arrow': {
      const x = Math.min(ann.a.x, ann.b.x)
      const y = Math.min(ann.a.y, ann.b.y)
      return {
        x,
        y,
        w: Math.abs(ann.a.x - ann.b.x),
        h: Math.abs(ann.a.y - ann.b.y),
      }
    }
  }
}

// Remap an annotation from one bounding box to another (drag-resize).
export function remapToBox(
  ann: Annotation,
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
): Annotation {
  const sx = from.w ? to.w / from.w : 1
  const sy = from.h ? to.h / from.h : 1
  const mp = (p: Point): Point => ({
    x: to.x + (p.x - from.x) * sx,
    y: to.y + (p.y - from.y) * sy,
  })
  switch (ann.kind) {
    case 'pen':
    case 'highlight':
      return { ...ann, points: ann.points.map(mp) }
    case 'text':
      return { ...ann, x: to.x, y: to.y + to.h, w: to.w, fontSize: Math.max(6, ann.fontSize * sy) }
    case 'rect':
    case 'ellipse':
    case 'redact':
    case 'image':
      return { ...ann, x: to.x, y: to.y, w: to.w, h: to.h }
    case 'line':
    case 'arrow':
      return { ...ann, a: mp(ann.a), b: mp(ann.b) }
  }
}

export function moveBy(ann: Annotation, dx: number, dy: number): Annotation {
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })
  switch (ann.kind) {
    case 'pen':
    case 'highlight':
      return { ...ann, points: ann.points.map(shift) }
    case 'text':
      return { ...ann, x: ann.x + dx, y: ann.y + dy }
    case 'rect':
    case 'ellipse':
    case 'redact':
    case 'image':
      return { ...ann, x: ann.x + dx, y: ann.y + dy }
    case 'line':
    case 'arrow':
      return { ...ann, a: shift(ann.a), b: shift(ann.b) }
  }
}

type Props = {
  ann: Annotation
  pageH: number
  interactive: boolean
  onPointerDown?: (e: React.PointerEvent, ann: Annotation) => void
}

// One annotation as SVG. Parent group flips Y, so text counter-flips itself.
export function AnnotationSvg({ ann, pageH, interactive, onPointerDown }: Props) {
  const hit = interactive
    ? { onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, ann), style: { cursor: 'move' } }
    : {}
  const fl = (y: number) => pageH - y // pdf y → svg y

  switch (ann.kind) {
    case 'pen':
    case 'highlight': {
      const d = ann.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${fl(p.y)}`)
        .join(' ')
      return (
        <path
          d={d}
          fill="none"
          stroke={ann.color}
          strokeWidth={ann.width}
          strokeOpacity={ann.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...hit}
        />
      )
    }
    case 'text': {
      const lines = ann.text.split('\n')
      return (
        <text
          x={ann.x}
          y={fl(ann.y - ann.fontSize)}
          fontSize={ann.fontSize}
          fill={ann.color}
          fontFamily="Helvetica, Arial, sans-serif"
          {...hit}
        >
          {lines.map((line, i) => (
            <tspan key={i} x={ann.x} dy={i === 0 ? 0 : ann.fontSize * 1.2}>
              {line}
            </tspan>
          ))}
        </text>
      )
    }
    case 'rect':
      return (
        <rect
          x={ann.x}
          y={fl(ann.y + ann.h)}
          width={ann.w}
          height={ann.h}
          fill={ann.fill ? ann.color : 'none'}
          fillOpacity={ann.fill ? 0.25 : 0}
          stroke={ann.color}
          strokeWidth={ann.width}
          {...hit}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          cx={ann.x + ann.w / 2}
          cy={fl(ann.y + ann.h / 2)}
          rx={Math.abs(ann.w / 2)}
          ry={Math.abs(ann.h / 2)}
          fill={ann.fill ? ann.color : 'none'}
          fillOpacity={ann.fill ? 0.25 : 0}
          stroke={ann.color}
          strokeWidth={ann.width}
          {...hit}
        />
      )
    case 'line':
      return (
        <line
          x1={ann.a.x}
          y1={fl(ann.a.y)}
          x2={ann.b.x}
          y2={fl(ann.b.y)}
          stroke={ann.color}
          strokeWidth={ann.width}
          strokeLinecap="round"
          {...hit}
        />
      )
    case 'arrow': {
      const angle = Math.atan2(fl(ann.b.y) - fl(ann.a.y), ann.b.x - ann.a.x)
      const head = Math.max(8, ann.width * 3)
      const wings = [1, -1].map((s) => {
        const a = angle + s * 0.45
        return `M${ann.b.x},${fl(ann.b.y)} L${ann.b.x - head * Math.cos(a)},${fl(ann.b.y) - head * Math.sin(a)}`
      })
      return (
        <path
          d={`M${ann.a.x},${fl(ann.a.y)} L${ann.b.x},${fl(ann.b.y)} ${wings.join(' ')}`}
          fill="none"
          stroke={ann.color}
          strokeWidth={ann.width}
          strokeLinecap="round"
          {...hit}
        />
      )
    }
    case 'redact':
      return (
        <rect
          x={ann.x}
          y={fl(ann.y + ann.h)}
          width={ann.w}
          height={ann.h}
          fill="#000"
          {...hit}
        />
      )
    case 'image':
      return (
        <image
          x={ann.x}
          y={fl(ann.y + ann.h)}
          width={ann.w}
          height={ann.h}
          href={ann.dataUrl}
          preserveAspectRatio="none"
          {...hit}
        />
      )
  }
}
