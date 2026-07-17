import { create } from 'zustand'
import type { Annotation, PageMeta, Snapshot, Tool } from '@/types'
import { uid } from '@/types'
import { isPremium } from '@/lib/entitlement'

export const BLANK_SRC = '__blank__'

type EditorState = {
  docName: string
  srcDocs: Record<string, ArrayBuffer>
  pages: PageMeta[]
  annotations: Record<string, Annotation[]>
  tool: Tool
  color: string
  width: number
  fontSize: number
  zoom: number
  fitWidth: boolean
  currentPage: number
  selectedId: string | null
  pendingStamp: string | null
  history: Snapshot[]
  future: Snapshot[]
  upgradeOpen: boolean
  upgradeReason: string | null
  premium: boolean

  setUpgradeOpen: (open: boolean, reason?: string) => void
  setPremiumState: (premium: boolean) => void
  restoreSession: (s: {
    docName: string
    srcDocs: Record<string, ArrayBuffer>
    pages: PageMeta[]
    annotations: Record<string, Annotation[]>
  }) => void

  openDoc: (name: string, bytes: ArrayBuffer) => void
  mergeDoc: (bytes: ArrayBuffer, pageCount: number) => void
  closeDoc: () => void
  setTool: (tool: Tool) => void
  setColor: (color: string) => void
  setWidth: (width: number) => void
  setFontSize: (fontSize: number) => void
  setZoom: (zoom: number, fitWidth?: boolean) => void
  setCurrentPage: (page: number) => void
  select: (id: string | null) => void
  setPendingStamp: (dataUrl: string | null) => void

  commit: () => void
  undo: () => void
  redo: () => void
  addAnnotation: (pageId: string, ann: Annotation) => void
  updateAnnotation: (pageId: string, ann: Annotation) => void
  removeAnnotation: (pageId: string, annId: string) => void
  rotatePage: (pageId: string) => void
  deletePage: (pageId: string) => void
  movePage: (from: number, to: number) => void
  insertBlankPage: (afterIndex: number) => void
}

const takeSnapshot = (s: EditorState): Snapshot => ({
  pages: s.pages.map((p) => ({ ...p })),
  annotations: Object.fromEntries(Object.entries(s.annotations).map(([k, v]) => [k, [...v]])),
})

export const useEditor = create<EditorState>((set) => ({
  docName: '',
  srcDocs: {},
  pages: [],
  annotations: {},
  tool: 'select',
  color: '#e11d48',
  width: 2.5,
  fontSize: 14,
  zoom: 1,
  fitWidth: true,
  currentPage: 0,
  selectedId: null,
  pendingStamp: null,
  history: [],
  future: [],
  upgradeOpen: false,
  upgradeReason: null,
  premium: isPremium(),

  setUpgradeOpen: (upgradeOpen, reason) =>
    set({ upgradeOpen, upgradeReason: reason ?? null }),
  setPremiumState: (premium) => set({ premium }),

  restoreSession: (s) =>
    set({
      docName: s.docName,
      srcDocs: s.srcDocs,
      pages: s.pages,
      annotations: s.annotations,
      history: [],
      future: [],
      currentPage: 0,
      selectedId: null,
    }),

  openDoc: (name, bytes) => {
    set({
      docName: name,
      srcDocs: { main: bytes },
      pages: [],
      annotations: {},
      history: [],
      future: [],
      currentPage: 0,
      selectedId: null,
    })
  },

  mergeDoc: (bytes, pageCount) => {
    const srcId = uid()
    set((s) => ({
      srcDocs: { ...s.srcDocs, [srcId]: bytes },
      pages: [
        ...s.pages,
        ...Array.from({ length: pageCount }, (_, i) => ({
          id: uid(),
          srcId,
          srcIndex: i,
          rotation: 0,
        })),
      ],
    }))
  },

  closeDoc: () =>
    set({
      docName: '',
      srcDocs: {},
      pages: [],
      annotations: {},
      history: [],
      future: [],
      selectedId: null,
      currentPage: 0,
    }),

  setTool: (tool) => set({ tool, selectedId: null }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  setFontSize: (fontSize) => set({ fontSize }),
  setZoom: (zoom, fitWidth = false) => set({ zoom, fitWidth }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  select: (selectedId) => set({ selectedId }),
  setPendingStamp: (pendingStamp) => set({ pendingStamp }),

  commit: () =>
    set((s) => ({
      history: [...s.history.slice(-49), takeSnapshot(s)],
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.history[s.history.length - 1]
      if (!prev) return s
      return {
        history: s.history.slice(0, -1),
        future: [takeSnapshot(s), ...s.future],
        pages: prev.pages,
        annotations: prev.annotations,
        selectedId: null,
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      return {
        future: s.future.slice(1),
        history: [...s.history, takeSnapshot(s)],
        pages: next.pages,
        annotations: next.annotations,
        selectedId: null,
      }
    }),

  addAnnotation: (pageId, ann) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        [pageId]: [...(s.annotations[pageId] ?? []), ann],
      },
    })),

  updateAnnotation: (pageId, ann) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        [pageId]: (s.annotations[pageId] ?? []).map((a) => (a.id === ann.id ? ann : a)),
      },
    })),

  removeAnnotation: (pageId, annId) =>
    set((s) => ({
      annotations: {
        ...s.annotations,
        [pageId]: (s.annotations[pageId] ?? []).filter((a) => a.id !== annId),
      },
      selectedId: s.selectedId === annId ? null : s.selectedId,
    })),

  rotatePage: (pageId) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
      ),
    })),

  deletePage: (pageId) =>
    set((s) => {
      if (s.pages.length <= 1) return s
      const annotations = { ...s.annotations }
      delete annotations[pageId]
      return { pages: s.pages.filter((p) => p.id !== pageId), annotations }
    }),

  movePage: (from, to) =>
    set((s) => {
      const pages = [...s.pages]
      const [moved] = pages.splice(from, 1)
      pages.splice(to, 0, moved)
      return { pages }
    }),

  insertBlankPage: (afterIndex) =>
    set((s) => {
      const pages = [...s.pages]
      pages.splice(afterIndex + 1, 0, {
        id: uid(),
        srcId: BLANK_SRC,
        srcIndex: 0,
        rotation: 0,
      })
      return { pages }
    }),
}))
