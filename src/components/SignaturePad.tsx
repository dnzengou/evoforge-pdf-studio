import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function SignaturePad({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 520
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
  }, [open])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * canvasRef.current!.width,
      y: ((e.clientY - r.top) / r.height) * canvasRef.current!.height,
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Draw signature — then click anywhere on the document to place it</DialogTitle>
        </DialogHeader>
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair rounded border border-zinc-600"
          onPointerDown={(e) => {
            drawing.current = true
            const ctx = canvasRef.current!.getContext('2d')!
            const p = pos(e)
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ;(e.target as Element).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = canvasRef.current!.getContext('2d')!
            const p = pos(e)
            ctx.strokeStyle = '#1d4ed8'
            ctx.lineWidth = 2.5
            ctx.lineCap = 'round'
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
            setEmpty(false)
          }}
          onPointerUp={() => (drawing.current = false)}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-800"
            onClick={() => {
              const ctx = canvasRef.current!.getContext('2d')!
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, 520, 200)
              setEmpty(true)
            }}
          >
            Clear
          </Button>
          <Button
            className="bg-sky-600 hover:bg-sky-500"
            disabled={empty}
            onClick={() => onDone(canvasRef.current!.toDataURL('image/png'))}
          >
            Use signature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
