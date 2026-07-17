import {
  AFFILIATE_LINKS,
  BUY_ME_A_COFFEE,
  PLAN_FEATURES,
  PREMIUM_PERIOD,
  PREMIUM_PRICE,
  STRIPE_CONFIGURED,
  STRIPE_PAYMENT_LINK,
} from '@/config/monetization'
import { setPremium } from '@/lib/entitlement'
import { useEditor } from '@/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Coffee, Crown, ExternalLink, X } from 'lucide-react'
import { FooterSig } from './FooterSig'

function FeatureValue({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={14} className="text-emerald-400" />
  if (v === false) return <X size={14} className="text-zinc-600" />
  return <span className="text-xs text-zinc-300">{v}</span>
}

export function UpgradeDialog() {
  const open = useEditor((s) => s.upgradeOpen)
  const reason = useEditor((s) => s.upgradeReason)
  const premium = useEditor((s) => s.premium)
  const store = useEditor.getState

  return (
    <Dialog open={open} onOpenChange={(v) => store().setUpgradeOpen(v)}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Crown size={18} className="text-amber-400" />
            {premium ? 'Premium active' : 'Go Premium'}
          </DialogTitle>
        </DialogHeader>

        {reason && !premium && (
          <div className="rounded border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            {reason}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-zinc-950 text-xs text-zinc-400">
                <th className="px-3 py-2 font-medium">Feature</th>
                <th className="w-32 px-3 py-2 font-medium">Free</th>
                <th className="w-32 px-3 py-2 font-medium text-amber-300">
                  Premium · {PREMIUM_PRICE} {PREMIUM_PERIOD}
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((f) => (
                <tr key={f.label} className="border-t border-zinc-800">
                  <td className="px-3 py-1.5 text-xs text-zinc-300">{f.label}</td>
                  <td className="px-3 py-1.5">
                    <FeatureValue v={f.free} />
                  </td>
                  <td className="px-3 py-1.5">
                    <FeatureValue v={f.premium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!premium && (
          <div className="flex flex-col gap-2">
            <Button
              className="h-10 bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
              disabled={!STRIPE_CONFIGURED}
              onClick={() => window.open(STRIPE_PAYMENT_LINK, '_blank', 'noopener')}
            >
              <Crown size={16} /> Upgrade with Stripe — {PREMIUM_PRICE} {PREMIUM_PERIOD}
            </Button>
            {!STRIPE_CONFIGURED && (
              <p className="text-center text-[11px] text-zinc-500">
                Checkout not wired yet — drop your Stripe Payment Link into{' '}
                <code className="text-zinc-400">src/config/monetization.ts</code>
              </p>
            )}
            <p className="text-center text-[11px] text-zinc-500">
              Secure checkout via Stripe. After payment you return here and Premium unlocks
              automatically.
            </p>
          </div>
        )}

        {premium && (
          <div className="flex items-center justify-between rounded bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
            <span>Thanks for supporting independent software 💚</span>
            <button
              className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              onClick={() => {
                setPremium(false)
                store().setPremiumState(false)
              }}
            >
              deactivate on this device
            </button>
          </div>
        )}

        <div className="mt-1 border-t border-zinc-800 pt-3">
          <div className="mb-2 text-xs font-semibold text-zinc-400">Support &amp; partners</div>
          <div className="flex flex-col gap-1.5">
            <a
              href={BUY_ME_A_COFFEE}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded border border-yellow-800/50 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-200 hover:bg-yellow-950/60"
            >
              <Coffee size={14} /> Buy me a coffee — keeps the lights on
              <ExternalLink size={11} className="ml-auto opacity-60" />
            </a>
            {AFFILIATE_LINKS.filter((l) => l.url !== BUY_ME_A_COFFEE).map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {l.label} <span className="text-zinc-500">— {l.note}</span>
                <ExternalLink size={11} className="ml-auto opacity-60" />
              </a>
            ))}
          </div>
        </div>

        <FooterSig className="pt-1 text-center" />
      </DialogContent>
    </Dialog>
  )
}
