export type Tool =
  | 'select'
  | 'pen'
  | 'highlight'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'redact'
  | 'eraser'
  | 'signature'
  | 'image'

export type Point = { x: number; y: number }

// All geometry lives in PDF "display space": points, origin bottom-left,
// after the page's user rotation. Export maps back to raw user space.
export type Annotation =
  | { id: string; kind: 'pen'; points: Point[]; color: string; width: number; opacity: number }
  | { id: string; kind: 'highlight'; points: Point[]; color: string; width: number; opacity: number }
  | { id: string; kind: 'text'; x: number; y: number; w: number; text: string; color: string; fontSize: number }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number; fill: boolean }
  | { id: string; kind: 'ellipse'; x: number; y: number; w: number; h: number; color: string; width: number; fill: boolean }
  | { id: string; kind: 'line'; a: Point; b: Point; color: string; width: number }
  | { id: string; kind: 'arrow'; a: Point; b: Point; color: string; width: number }
  | { id: string; kind: 'redact'; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'image'; x: number; y: number; w: number; h: number; dataUrl: string }

export type PageMeta = {
  id: string
  srcId: string
  srcIndex: number
  rotation: number // user delta, clockwise degrees, 0/90/180/270
}

export type Snapshot = {
  pages: PageMeta[]
  annotations: Record<string, Annotation[]>
}

export type PiiHit = {
  pageId: string
  kind: string
  value: string
  rect: { x: number; y: number; w: number; h: number }
}

export type FormField = { pageId: string; name: string; fieldType: string }

export const uid = () => Math.random().toString(36).slice(2, 10)
