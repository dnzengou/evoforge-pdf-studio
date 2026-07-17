import { useEffect, useRef, useState } from 'react'
import { renderPage } from '@/lib/pdfEngine'
import { BLANK_SRC, useEditor } from '@/store'
import { gotoPage } from './EditorArea'
import { FilePlus, RotateCw, Trash2 } from 'lucide-react'

function Thumb({ pageId, index }: { pageId: string; index: number }) {
  const meta = useEditor((s) => s.pages.find((p) => p.id === pageId))!
  const currentPage = useEditor((s) => s.currentPage)
  const srcDocs = useEditor((s) => s.srcDocs)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (meta.srcId === BLANK_SRC) return
    const canvas = canvasRef.current
    if (!canvas) return
    let live = true
    renderPage(meta.srcId, meta.srcIndex, meta.rotation, 0.22, canvas).then(() => {
      if (live) canvas.style.width = '100%'
    }).catch(() => {})
    return () => {
      live = false
    }
  }, [meta, srcDocs])

  const active = index === currentPage
  return (
    <div
      className={`group relative mb-3 cursor-pointer rounded border-2 p-1 transition ${
        active ? 'border-sky-400 bg-sky-400/10' : 'border-transparent hover:border-zinc-600'
      } ${dragOver ? 'border-emerald-400' : ''}`}
      onClick={() => gotoPage(index)}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/evo-page', String(index))}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const from = Number(e.dataTransfer.getData('text/evo-page'))
        if (!Number.isNaN(from) && from !== index) {
          useEditor.getState().commit()
          useEditor.getState().movePage(from, index)
        }
      }}
    >
      {meta.srcId === BLANK_SRC ? (
        <div className="flex aspect-[8.5/11] items-center justify-center bg-white text-[10px] text-zinc-400">
          Blank
        </div>
      ) : (
        <canvas ref={canvasRef} className="block w-full" />
      )}
      <div className="mt-1 text-center text-[11px] text-zinc-400">{index + 1}</div>
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          title="Rotate 90°"
          className="rounded bg-zinc-800/90 p-1 text-zinc-300 hover:text-white"
          onClick={(e) => {
            e.stopPropagation()
            useEditor.getState().commit()
            useEditor.getState().rotatePage(pageId)
          }}
        >
          <RotateCw size={12} />
        </button>
        <button
          title="Insert blank page after"
          className="rounded bg-zinc-800/90 p-1 text-zinc-300 hover:text-white"
          onClick={(e) => {
            e.stopPropagation()
            useEditor.getState().commit()
            useEditor.getState().insertBlankPage(index)
          }}
        >
          <FilePlus size={12} />
        </button>
        <button
          title="Delete page"
          className="rounded bg-zinc-800/90 p-1 text-zinc-300 hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation()
            useEditor.getState().commit()
            useEditor.getState().deletePage(pageId)
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export function ThumbRail() {
  const pages = useEditor((s) => s.pages)
  return (
    <div className="h-full w-36 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-2">
      {pages.map((p, i) => (
        <Thumb key={p.id} pageId={p.id} index={i} />
      ))}
    </div>
  )
}
