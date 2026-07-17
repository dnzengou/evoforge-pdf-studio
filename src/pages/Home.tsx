import { useCallback, useEffect, useState } from 'react'
import { loadDoc } from '@/lib/pdfEngine'
import { useEditor } from '@/store'
import type { PageMeta } from '@/types'
import { uid } from '@/types'
import { TopBar } from '@/components/TopBar'
import { ThumbRail } from '@/components/ThumbRail'
import { EditorArea } from '@/components/EditorArea'
import { SidePanel } from '@/components/SidePanel'
import { FileUp, ShieldCheck, Sparkles, Zap } from 'lucide-react'

export default function Home() {
  const hasDoc = useEditor((s) => s.pages.length > 0)
  const store = useEditor.getState
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const openFile = useCallback(
    async (file: File, merge: boolean) => {
      setError(null)
      try {
        const bytes = await file.arrayBuffer()
        const srcId = merge ? uid() : 'main'
        const { numPages } = await loadDoc(srcId, bytes)
        if (merge) {
          store().commit()
          store().mergeDoc(bytes, numPages)
          return
        }
        store().openDoc(file.name, bytes)
        const pages: PageMeta[] = Array.from({ length: numPages }, (_, i) => ({
          id: uid(),
          srcId: 'main',
          srcIndex: i,
          rotation: 0,
        }))
        useEditor.setState({ pages })
      } catch {
        setError('Could not read that file. Encrypted or corrupted PDFs are not supported yet.')
      }
    },
    [store],
  )

  // Global shortcuts: tools, undo/redo, delete, save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const s = useEditor.getState()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      const map: Record<string, Parameters<typeof s.setTool>[0]> = {
        v: 'select', p: 'pen', h: 'highlight', t: 'text', r: 'rect',
        o: 'ellipse', l: 'line', a: 'arrow', x: 'redact', e: 'eraser',
      }
      const tool = map[e.key.toLowerCase()]
      if (tool && !e.ctrlKey && !e.metaKey) s.setTool(tool)
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        for (const [pageId, anns] of Object.entries(s.annotations)) {
          if (anns.some((a) => a.id === s.selectedId)) {
            s.commit()
            s.removeAnnotation(pageId, s.selectedId)
            break
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drag-and-drop a PDF anywhere to open it.
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer?.files?.[0]
      if (f?.type === 'application/pdf' || f?.name.endsWith('.pdf')) openFile(f, hasDoc)
    }
    const onDrag = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(true)
    }
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragOver(false)
    }
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragover', onDrag)
    window.addEventListener('dragleave', onLeave)
    return () => {
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragover', onDrag)
      window.removeEventListener('dragleave', onLeave)
    }
  }, [openFile, hasDoc])

  if (!hasDoc) return <Landing onOpen={openFile} error={error} dragOver={dragOver} />

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <TopBar onOpen={openFile} />
      <div className="flex min-h-0 flex-1">
        <ThumbRail />
        <EditorArea />
        <SidePanel />
      </div>
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sky-500/20 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-sky-300 bg-zinc-950/90 px-10 py-8 text-lg font-semibold text-sky-200">
            Drop to merge PDF
          </div>
        </div>
      )}
    </div>
  )
}

function Landing({
  onOpen,
  error,
  dragOver,
}: {
  onOpen: (f: File, merge: boolean) => void
  error: string | null
  dragOver: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 text-lg font-bold">
          E
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Evoforge PDF Studio</h1>
      </div>
      <p className="mb-8 text-sm text-zinc-400">
        Annotate · Sign · Reorder · Merge · Redact · Summarize — 100% in-browser, nothing uploaded.
      </p>
      <label
        className={`flex w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 transition ${
          dragOver ? 'border-sky-400 bg-sky-400/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onOpen(e.target.files[0], false)}
        />
        <FileUp size={40} className="mb-3 text-sky-400" />
        <span className="text-lg font-semibold">Drop a PDF or click to open</span>
        <span className="mt-1 text-xs text-zinc-500">Processed locally — your file never leaves this tab</span>
      </label>
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
      <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4 text-center text-xs text-zinc-400">
        <div className="rounded-lg border border-zinc-800 p-4">
          <Zap size={16} className="mx-auto mb-2 text-amber-400" />
          Full editor — draw, highlight, text, shapes, signatures, page surgery, flattened export.
        </div>
        <div className="rounded-lg border border-zinc-800 p-4">
          <Sparkles size={16} className="mx-auto mb-2 text-violet-400" />
          EvometaClaw local AI — summaries, keywords, PII detection, form scan. No API keys.
        </div>
        <div className="rounded-lg border border-zinc-800 p-4">
          <ShieldCheck size={16} className="mx-auto mb-2 text-emerald-400" />
          Private by design — zero servers, zero uploads, zero tracking.
        </div>
      </div>
    </div>
  )
}
