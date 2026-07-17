import { useEffect, useRef, useState } from 'react'
import { useEditor } from '@/store'
import { PageView } from './PageView'

export function EditorArea() {
  const { pages, zoom, fitWidth } = useEditor()
  const store = useEditor.getState
  const containerRef = useRef<HTMLDivElement>(null)
  const [editingText, setEditingText] =
    useState<React.ComponentProps<typeof PageView>['editingText']>(null)

  // Fit-width: derive scale from container and first page width (approx 612pt fallback).
  useEffect(() => {
    if (!fitWidth) return
    const el = containerRef.current
    if (!el) return
    const apply = () => {
      const w = el.clientWidth - 96
      if (w > 100) store().setZoom(Math.min(w / 660, 3), true)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitWidth, pages.length, store])

  // Track current page from scroll position for the page indicator.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const kids = el.querySelectorAll('[data-page-index]')
      const mid = el.scrollTop + el.clientHeight / 3
      for (const kid of kids) {
        const top = (kid as HTMLElement).offsetTop
        const bottom = top + (kid as HTMLElement).offsetHeight
        if (mid >= top && mid < bottom) {
          store().setCurrentPage(Number((kid as HTMLElement).dataset.pageIndex))
          break
        }
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [store])

  // Expose scroll-to-page for thumbnails / nav / search.
  useEffect(() => {
    const handler = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail
      const kid = containerRef.current?.querySelector(`[data-page-index="${idx}"]`)
      kid?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('evo:goto-page', handler)
    return () => window.removeEventListener('evo:goto-page', handler)
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full flex-1 overflow-auto bg-zinc-900 px-8 py-6"
      onClick={() => {
        if (editingText) setEditingText(null)
      }}
    >
      {pages.map((meta, i) => (
        <PageView
          key={meta.id}
          meta={meta}
          index={i}
          scale={zoom}
          editingText={editingText}
          setEditingText={setEditingText}
        />
      ))}
    </div>
  )
}

export function gotoPage(index: number) {
  window.dispatchEvent(new CustomEvent('evo:goto-page', { detail: index }))
}
