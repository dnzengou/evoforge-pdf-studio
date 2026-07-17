import { useState } from 'react'
import { formFields, matchRects, pageText } from '@/lib/pdfEngine'
import { countWords, keywords, PII_PATTERNS, summarize } from '@/lib/aiTools'
import { FREE_LIMITS } from '@/config/monetization'
import { canRunAi, recordAiRun } from '@/lib/entitlement'
import { FooterSig } from './FooterSig'
import { BLANK_SRC, useEditor } from '@/store'
import type { FormField, PiiHit } from '@/types'
import { uid } from '@/types'
import { gotoPage } from './EditorArea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrainCircuit, FileWarning, ListChecks, Loader2, ShieldCheck } from 'lucide-react'

type Summary = { lines: string[]; keys: string[]; words: number }

export function SidePanel() {
  const pages = useEditor((s) => s.pages)
  const store = useEditor.getState
  const [busy, setBusy] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pii, setPii] = useState<PiiHit[] | null>(null)
  const [fields, setFields] = useState<FormField[] | null>(null)

  const allText = async (): Promise<{ pageId: string; text: string }[]> => {
    const s = store()
    const out: { pageId: string; text: string }[] = []
    for (const meta of s.pages) {
      if (meta.srcId === BLANK_SRC) continue
      try {
        out.push({ pageId: meta.id, text: await pageText(meta.srcId, meta.srcIndex) })
      } catch {
        out.push({ pageId: meta.id, text: '' })
      }
    }
    return out
  }

  const runSummary = async () => {
    if (!canRunAi()) {
      store().setUpgradeOpen(
        true,
        `Free plan: ${FREE_LIMITS.aiRunsPerDay} AI summaries/day used. Premium removes the cap.`,
      )
      return
    }
    setBusy('summary')
    recordAiRun()
    try {
      const parts = await allText()
      const full = parts.map((p) => p.text).join(' ')
      setSummary({
        lines: summarize(full, 6),
        keys: keywords(full, 12),
        words: countWords(full),
      })
    } finally {
      setBusy(null)
    }
  }

  const runPii = async () => {
    setBusy('pii')
    try {
      const s = store()
      const hits: PiiHit[] = []
      for (const meta of s.pages) {
        if (meta.srcId === BLANK_SRC) continue
        for (const { kind, pattern } of PII_PATTERNS) {
          try {
            const rects = await matchRects(meta.srcId, meta.srcIndex, meta.rotation, pattern)
            for (const r of rects) hits.push({ pageId: meta.id, kind, value: r.value, rect: r.rect })
          } catch {
            // page without text layer — skip
          }
        }
      }
      setPii(hits)
    } finally {
      setBusy(null)
    }
  }

  const runFields = async () => {
    setBusy('fields')
    try {
      const s = store()
      const found: FormField[] = []
      for (const meta of s.pages) {
        if (meta.srcId === BLANK_SRC) continue
        try {
          for (const f of await formFields(meta.srcId, meta.srcIndex)) {
            found.push({ pageId: meta.id, ...f })
          }
        } catch {
          // skip
        }
      }
      setFields(found)
    } finally {
      setBusy(null)
    }
  }

  const coverHit = (hit: PiiHit) => {
    store().commit()
    store().addAnnotation(hit.pageId, {
      id: uid(),
      kind: 'redact',
      x: hit.rect.x - 2,
      y: hit.rect.y - 2,
      w: hit.rect.w + 4,
      h: hit.rect.h + 4,
    })
    setPii((prev) => prev?.filter((h) => h !== hit) ?? null)
  }

  const coverAll = () => {
    if (!pii?.length) return
    store().commit()
    for (const hit of pii) {
      store().addAnnotation(hit.pageId, {
        id: uid(),
        kind: 'redact',
        x: hit.rect.x - 2,
        y: hit.rect.y - 2,
        w: hit.rect.w + 4,
        h: hit.rect.h + 4,
      })
    }
    setPii([])
  }

  const pageIndexOf = (pageId: string) => pages.findIndex((p) => p.id === pageId)

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
        <BrainCircuit size={16} className="text-violet-400" />
        <span className="text-xs font-semibold tracking-wide text-zinc-200">
          EVOMETACLAW — LOCAL AI
        </span>
      </div>
      <Tabs defaultValue="ai" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-2 mt-2 grid grid-cols-3 bg-zinc-900">
          <TabsTrigger value="ai" className="text-xs">Summary</TabsTrigger>
          <TabsTrigger value="pii" className="text-xs">Redact</TabsTrigger>
          <TabsTrigger value="fields" className="text-xs">Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="min-h-0 flex-1 overflow-y-auto p-3">
          <Button
            size="sm"
            className="w-full bg-violet-600 text-xs hover:bg-violet-500"
            disabled={busy !== null || !pages.length}
            onClick={runSummary}
          >
            {busy === 'summary' ? <Loader2 size={14} className="animate-spin" /> : 'Analyze document'}
          </Button>
          {summary && (
            <div className="mt-3 space-y-3 text-xs text-zinc-300">
              <div className="text-zinc-500">
                {summary.words.toLocaleString()} words · {pages.length} pages
              </div>
              <div>
                <div className="mb-1 font-semibold text-zinc-200">Key points</div>
                <ul className="list-disc space-y-1.5 pl-4 leading-snug">
                  {summary.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold text-zinc-200">Keywords</div>
                <div className="flex flex-wrap gap-1">
                  {summary.keys.map((k) => (
                    <span key={k} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!summary && busy !== 'summary' && (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Extractive summary runs fully on-device. Nothing leaves the browser.
            </p>
          )}
        </TabsContent>

        <TabsContent value="pii" className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-rose-700 text-xs hover:bg-rose-600"
              disabled={busy !== null || !pages.length}
              onClick={runPii}
            >
              {busy === 'pii' ? <Loader2 size={14} className="animate-spin" /> : 'Scan for PII'}
            </Button>
            {pii && pii.length > 0 && (
              <Button size="sm" variant="outline"
                className="border-rose-800 bg-transparent text-xs text-rose-300 hover:bg-rose-950"
                onClick={coverAll}>
                Cover all
              </Button>
            )}
          </div>
          {pii && (
            <div className="mt-3 space-y-1.5">
              {pii.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <ShieldCheck size={14} /> No PII patterns found.
                </div>
              )}
              {pii.map((h, i) => (
                <div key={i} className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-rose-300">{h.kind}</span>
                    <button
                      className="text-zinc-500 hover:text-sky-400"
                      onClick={() => gotoPage(pageIndexOf(h.pageId))}
                    >
                      p.{pageIndexOf(h.pageId) + 1}
                    </button>
                  </div>
                  <div className="mt-0.5 break-all text-zinc-400">{h.value}</div>
                  <button
                    className="mt-1.5 flex items-center gap-1 text-rose-300 hover:text-rose-200"
                    onClick={() => coverHit(h)}
                  >
                    <FileWarning size={12} /> Cover with redaction box
                  </button>
                </div>
              ))}
            </div>
          )}
          {!pii && busy !== 'pii' && (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Finds emails, phone numbers, SSNs, cards, IBANs, IPs. One click covers each with a
              redaction box burned into the export.
            </p>
          )}
        </TabsContent>

        <TabsContent value="fields" className="min-h-0 flex-1 overflow-y-auto p-3">
          <Button
            size="sm"
            className="w-full bg-zinc-700 text-xs hover:bg-zinc-600"
            disabled={busy !== null || !pages.length}
            onClick={runFields}
          >
            {busy === 'fields' ? <Loader2 size={14} className="animate-spin" /> : 'Detect form fields'}
          </Button>
          {fields && (
            <div className="mt-3 space-y-1.5">
              {fields.length === 0 && (
                <div className="text-xs text-zinc-500">
                  No AcroForm fields. Flat PDF — use the Text tool to fill it manually.
                </div>
              )}
              {fields.map((f, i) => (
                <button
                  key={i}
                  className="flex w-full items-center gap-2 rounded border border-zinc-800 bg-zinc-900 p-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                  onClick={() => gotoPage(pageIndexOf(f.pageId))}
                >
                  <ListChecks size={12} className="shrink-0 text-sky-400" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-zinc-500">{f.fieldType}</span>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <FooterSig className="border-t border-zinc-800 px-3 py-2" />
    </div>
  )
}
