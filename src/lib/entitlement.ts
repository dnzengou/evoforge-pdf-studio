// Premium flag + daily usage counters. Client-side honesty: real license
// validation needs a backend webhook later; this gates UX, not security.
import { FREE_LIMITS } from '@/config/monetization'

const PREMIUM_KEY = 'evo_premium'

export function isPremium(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === '1'
  } catch {
    return false
  }
}

export function setPremium(value: boolean): void {
  try {
    value ? localStorage.setItem(PREMIUM_KEY, '1') : localStorage.removeItem(PREMIUM_KEY)
  } catch {
    // private mode — premium just won't persist
  }
}

// Stripe Payment Link success URL lands on /?upgraded=1 — consume and unlock.
export function consumeUpgradeParam(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('upgraded') !== '1') return false
  setPremium(true)
  params.delete('upgraded')
  const qs = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
  return true
}

type Usage = { exports: number; ai: number }

const dayKey = () => `evo_usage_${new Date().toISOString().slice(0, 10)}`

function readUsage(): Usage {
  try {
    const raw = localStorage.getItem(dayKey())
    return raw ? (JSON.parse(raw) as Usage) : { exports: 0, ai: 0 }
  } catch {
    return { exports: 0, ai: 0 }
  }
}

function bump(field: keyof Usage): void {
  try {
    const usage = readUsage()
    usage[field] += 1
    localStorage.setItem(dayKey(), JSON.stringify(usage))
  } catch {
    // storage full/blocked — counting is best-effort
  }
}

export const usageToday = readUsage

export function canExport(): boolean {
  return isPremium() || readUsage().exports < FREE_LIMITS.exportsPerDay
}

export function recordExport(): void {
  bump('exports')
}

export function canRunAi(): boolean {
  return isPremium() || readUsage().ai < FREE_LIMITS.aiRunsPerDay
}

export function recordAiRun(): void {
  bump('ai')
}
