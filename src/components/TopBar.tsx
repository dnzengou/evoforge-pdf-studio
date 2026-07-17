import { useRef, useState } from 'react'
import { exportPdf } from '@/lib/exportPdf'
import { loadDoc, pageText } from '@/lib/pdfEngine'
import { BUY_ME_A_COFFEE, FREE_LIMITS } from '@/config/monetization'
import { canExport, recordExport } from '@/lib/entitlement'
import { useEditor } from '@/store'
import type { Tool } from '@/types'
import { gotoPage } from './EditorArea'
import { SignaturePad } from './SignaturePad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FilePlus2,
  FolderOpen,
  Highlighter,
  Image as ImageIcon,
  Minus,
  Coffee,
  Crown,
  MousePointer2,
  PenLine,
  PenTool,
  Plus,
  Redo2,
  Search,
  Slash,
  Square,
  Circle,
  Type,
  Undo2,
} from 'lucide-react'

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select (V)', icon: <MousePointer2 size={16} /> },
  { id: 'pen', label: 'Draw (P)', icon: <PenLine size={16} /> },
  { id: 'highlight', label: 'Highlight (H)', icon: <Highlighter size={16} /> },
  { id: 'text', label: 'Text (T)', icon: <Type size={16} /> },
  { id: 'rect', label: 'Rectangle (R)', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse (O)', icon: <Circle size={16} /> },
  { id: 'line', label: 'Line (L)', icon: <Slash size={16} /> },
  { id: 'arrow', label: 'Arrow (A)', icon: <ArrowRight size={16} /> },
  { id: 'redact', label: 'Redact (X)', icon: <Square size={16} fill="currentColor" /> },
  { id: 'eraser', label: 'Eraser (E)', icon: <Eraser size={16} /> },
  { id: 'signature', label: 'Signature (S)', icon: <PenTool size={16} /> },
  { id: 'image', label: 'Image stamp (I)', icon: <ImageIcon size={16} /> },
]

const COLORS = ['#e11d48', '#f97316', '#facc15', '#16a34a', '#2563eb', '#7c3aed', '#000000', '#ffffff']

export function TopBar({ onOpen }: { onOpen: (f: File, merge: boolean) => void }) {
  const { tool, color, width, zoom, pages, currentPage, history, future, docName, premium } =
    useEditor()
  const store = useEditor.getState
  const fileRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const [sigOpen, setSigOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ page: number; snippet: string }[] | null>(null)

  const save = async () => {
    const s = store()
    if (!canExport()) {
      s.setUpgradeOpen(
        true,
        `Free plan: ${FREE_LIMITS.exportsPerDay} exports/day reached. Premium removes the cap and the watermark.`,
      )
      return
    }
    setSaving(true)
    try {
      const watermark = s.premium ? undefined : FREE_LIMITS.watermark
      const bytes = await exportPdf(s.srcDocs, s.pages, s.annotations, { watermark })
      recordExport()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (docName || 'document').replace(/\.pdf$/i, '') + '-edited.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setSaving(false)
    }
  }

  const search = async () => {
    const q = query.trim().toLowerCase()
    if (!q) return setHits(null)
    const s = store()
    const found: { page: number; snippet: string }[] = []
    for (let i = 0; i < s.pages.length; i++) {
      const meta = s.pages[i]
      if (meta.srcId === '__blank__') continue
      try {
        const text = (await pageText(meta.srcId, meta.srcIndex)).toLowerCase()
        const at = text.indexOf(q)
        if (at >= 0) found.push({ page: i, snippet: text.slice(Math.max(0, at - 30), at + q.length + 30) })
      } catch {
        // unreadable page text — skip
      }
    }
    setHits(found)
    if (found.length) gotoPage(found[0].page)
  }

  const pickStamp = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      store().setPendingStamp(reader.result as string)
      store().setTool('image')
    }
    reader.readAsDataURL(f)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-2">
        <div className="mr-1 flex items-center gap-1.5 pl-1">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-sky-400 to-violet-500 text-[11px] font-bold text-white">
            E
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">Evoforge PDF</span>
        </div>
        <Separator orientation="vertical" className="mx-1 h-6 bg-zinc-800" />
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => e.target.files?.[0] && onOpen(e.target.files[0], false)} />
        <input ref={mergeRef} type="file" accept="application/pdf" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const bytes = await f.arrayBuffer()
            const { numPages } = await loadDoc('probe', bytes)
            store().commit()
            store().mergeDoc(bytes, numPages)
            e.target.value = ''
          }} />
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && pickStamp(e.target.files[0])} />

        <BarBtn label="Open PDF" onClick={() => fileRef.current?.click()} icon={<FolderOpen size={16} />} />
        <BarBtn label="Merge PDF" onClick={() => mergeRef.current?.click()} icon={<FilePlus2 size={16} />} />
        <Button size="sm" variant="default" className="h-8 gap-1 bg-sky-600 text-xs hover:bg-sky-500"
          onClick={save} disabled={saving || !pages.length}>
          <Download size={14} /> {saving ? 'Saving…' : 'Export'}
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6 bg-zinc-800" />

        {TOOLS.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                className={`rounded p-1.5 ${
                  tool === t.id ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
                onClick={() => {
                  if (t.id === 'signature') {
                    store().setTool('signature')
                    setSigOpen(true)
                  } else if (t.id === 'image') {
                    imgRef.current?.click()
                  } else {
                    store().setTool(t.id)
                  }
                }}
              >
                {t.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="ml-1 flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`h-4 w-4 rounded-full border ${color === c ? 'ring-2 ring-sky-400' : 'border-zinc-600'}`}
              style={{ backgroundColor: c }}
              onClick={() => store().setColor(c)}
            />
          ))}
          <input
            type="range" min={1} max={10} step={0.5} value={width}
            onChange={(e) => store().setWidth(Number(e.target.value))}
            className="ml-1 w-16 accent-sky-500" title="Stroke width"
          />
        </div>
        <Separator orientation="vertical" className="mx-1 h-6 bg-zinc-800" />

        <BarBtn label="Undo" onClick={() => store().undo()} icon={<Undo2 size={16} />} disabled={!history.length} />
        <BarBtn label="Redo" onClick={() => store().redo()} icon={<Redo2 size={16} />} disabled={!future.length} />
        <Separator orientation="vertical" className="mx-1 h-6 bg-zinc-800" />

        <div className="flex items-center gap-0.5 text-zinc-300">
          <BarBtn label="Zoom out" onClick={() => store().setZoom(Math.max(0.25, zoom - 0.15))} icon={<Minus size={14} />} />
          <button className="w-12 text-center text-xs hover:text-white" title="Fit width"
            onClick={() => store().setZoom(zoom, true)}>
            {Math.round(zoom * 100)}%
          </button>
          <BarBtn label="Zoom in" onClick={() => store().setZoom(Math.min(4, zoom + 0.15))} icon={<Plus size={14} />} />
        </div>
        <div className="ml-1 flex items-center gap-1 text-xs text-zinc-400">
          <BarBtn label="Previous page" onClick={() => gotoPage(Math.max(0, currentPage - 1))} icon={<ChevronLeft size={14} />} />
          <span className="w-14 text-center">{pages.length ? `${currentPage + 1} / ${pages.length}` : '—'}</span>
          <BarBtn label="Next page" onClick={() => gotoPage(Math.min(pages.length - 1, currentPage + 1))} icon={<ChevronRight size={14} />} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={BUY_ME_A_COFFEE}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1.5 text-yellow-400/80 hover:bg-zinc-800 hover:text-yellow-300"
              >
                <Coffee size={16} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">Buy me a coffee</TooltipContent>
          </Tooltip>
          {premium ? (
            <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300">
              <Crown size={12} /> PRO
            </span>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1 bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
              onClick={() => store().setUpgradeOpen(true)}
            >
              <Crown size={13} /> Upgrade
            </Button>
          )}
        </div>
        <div className="relative ml-2 flex items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search text…"
            className="h-8 w-44 border-zinc-700 bg-zinc-900 pr-7 text-xs text-zinc-200"
          />
          <button className="absolute right-1.5 text-zinc-500 hover:text-zinc-200" onClick={search}>
            <Search size={14} />
          </button>
          {hits && (
            <div className="absolute right-0 top-9 z-50 max-h-64 w-72 overflow-auto rounded border border-zinc-700 bg-zinc-900 p-1 text-xs shadow-xl">
              <div className="flex items-center justify-between px-2 py-1 text-zinc-400">
                <span>{hits.length} match{hits.length === 1 ? '' : 'es'}</span>
                <button onClick={() => setHits(null)} className="hover:text-white">✕</button>
              </div>
              {hits.map((h, i) => (
                <button
                  key={i}
                  className="block w-full rounded px-2 py-1 text-left text-zinc-300 hover:bg-zinc-800"
                  onClick={() => gotoPage(h.page)}
                >
                  <span className="mr-1 text-sky-400">p.{h.page + 1}</span>
                  …{h.snippet}…
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <SignaturePad
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        onDone={(dataUrl) => {
          store().setPendingStamp(dataUrl)
          setSigOpen(false)
        }}
      />
    </TooltipProvider>
  )
}

function BarBtn({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string
  onClick: () => void
  icon: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
