import { useCallback, useEffect, useState } from 'react'
import { loadDoc } from '@/lib/pdfEngine'
import { consumeUpgradeParam, setPremium } from '@/lib/entitlement'
import { loadSession, saveSessionDebounced, type SavedSession } from '@/lib/persistence'
import { useEditor } from '@/store'
import type { PageMeta } from '@/types'
import { uid } from '@/types'
import { TopBar } from '@/components/TopBar'
import { ThumbRail } from '@/components/ThumbRail'
import { EditorArea } from '@/components/EditorArea'
import { SidePanel } from '@/components/SidePanel'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { FooterSig } from '@/components/FooterSig'
import { BUY_ME_A_COFFEE } from '@/config/monetization'
import { Coffee, FileUp, History, ShieldCheck, Sparkles, Zap } from 'lucide-react'

export default function Home() {
  const hasDoc = useEditor((s) => s.pages.length > 0)
  const store = useEditor.getState
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saved, setSaved] = useState<SavedSession | null>(null)
  const [justUpgraded, setJustUpgraded] = useState(false)

  // Stripe success URL lands here — unlock premium.
  useEffect(() => {
    if (consumeUpgradeParam()) {
      setPremium(true)
      store().setPremiumState(true)
      setJustUpgraded(true)
    }
  }, [store])

  // Look for a previous session to offer one-click resume (retention hook).
  useEffect(() => {
    loadSession().then((s) => s?.pages.length && setSaved(s))
  }, [])

  // Autosave the working session (debounced) whenever state changes.
  useEffect(() => {
    const unsub = useEditor.subscribe((s) => {
      if (!s.pages.length) return
      saveSessionDebounced({
        docName: s.docName,
        srcDocs: s.srcDocs,
        pages: s.pages,
        annotations: s.annotations,
        savedAt: Date.now(),
      })
    })
    return unsub
  }, [])

  const resume = useCallback(async (s: SavedSession) => {
    setError(null)
    try {
      for (const [srcId, bytes] of Object.entries(s.srcDocs)) {
        if (srcId !== '__blank__') await loadDoc(srcId, bytes)
      }
      store().restoreSession(s)
    } catch {
      setError('Could not restore the previous session.')
    }
  }, [store])

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

  if (!hasDoc) {
    return (
      <>
        <Landing
          onOpen={openFile}
          error={error}
          dragOver={dragOver}
          saved={saved}
          onResume={() => saved && resume(saved)}
          justUpgraded={justUpgraded}
        />
        <UpgradeDialog />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <TopBar onOpen={openFile} />
      <div className="flex min-h-0 flex-1">
        <ThumbRail />
        <EditorArea />
        <SidePanel />
      </div>
      <UpgradeDialog />
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
  saved,
  onResume,
  justUpgraded,
}: {
  onOpen: (f: File, merge: boolean) => void
  error: string | null
  dragOver: boolean
  saved: SavedSession | null
  onResume: () => void
  justUpgraded: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100">
      {justUpgraded && (
        <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/60 px-4 py-2 text-sm text-emerald-300">
          Premium activated — thank you 💚
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 text-lg font-bold">
          E
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Evoforge PDF Studio</h1>
      </div>
      <p className="mb-8 text-sm text-zinc-400">
        Annotate · Sign · Reorder · Merge · Redact · Summarize — 100% in-browser, nothing uploaded.
      </p>
      {saved && (
        <button
          onClick={onResume}
          className="mb-4 flex w-full max-w-xl items-center gap-3 rounded-xl border border-sky-800 bg-sky-950/40 px-5 py-3 text-left hover:bg-sky-950/70"
        >
          <History size={18} className="shrink-0 text-sky-400" />
          <span>
            <span className="block text-sm font-medium text-sky-200">
              Continue where you left off
            </span>
            <span className="block text-xs text-zinc-400">
              {saved.docName} · {saved.pages.length} pages ·{' '}
              {new Date(saved.savedAt).toLocaleString()}
            </span>
          </span>
        </button>
      )}
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
      <div className="mt-10 flex items-center gap-4">
        <FooterSig />
        <span className="text-zinc-700">·</span>
        <a
          href={BUY_ME_A_COFFEE}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-yellow-400/80 hover:text-yellow-300"
        >
          <Coffee size={11} /> Buy me a coffee
        </a>
      </div>
    </div>
  )
}
