// Session autosave → IndexedDB. Retention hook: user returns, work is waiting.
import type { Annotation, PageMeta } from '@/types'

export type SavedSession = {
  docName: string
  srcDocs: Record<string, ArrayBuffer>
  pages: PageMeta[]
  annotations: Record<string, Annotation[]>
  savedAt: number
}

const DB_NAME = 'evoforge'
const STORE = 'session'
const KEY = 'current'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => {
      const db = req.result
      db.onclose = () => { dbPromise = null }
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

export async function saveSession(session: SavedSession): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(session, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadSession(): Promise<SavedSession | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve((req.result as SavedSession) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb()
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY)
  } catch {
    // nothing to clear
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

export function saveSessionDebounced(session: SavedSession, ms = 800): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    saveSession(session).catch(() => {})
  }, ms)
}
