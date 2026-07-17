import { BRAND } from '@/config/monetization'

export function FooterSig({ className = '' }: { className?: string }) {
  return (
    <div className={`text-[11px] text-zinc-500 ${className}`}>
      Made by{' '}
      <a
        href={BRAND.makerUrl}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-sky-400"
      >
        {BRAND.maker}
      </a>{' '}
      with 💚 &amp; ☕️
    </div>
  )
}
