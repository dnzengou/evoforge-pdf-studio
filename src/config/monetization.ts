// Single source for money + growth config. Swap links here, ship nowhere else.

export const BRAND = {
  maker: 'desiredsolutions.me',
  makerUrl: 'https://desiredsolutions.me',
  appName: 'Evoforge PDF Studio',
}

// Stripe Payment Link for Premium. Create one in Stripe Dashboard → Payment Links,
// set the success URL to  <app-url>/?upgraded=1  so the app unlocks on return.
// Replace the placeholder before launch — checkout stays disabled until you do.
export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK'
export const STRIPE_CONFIGURED = !STRIPE_PAYMENT_LINK.includes('REPLACE_WITH')

export const PREMIUM_PRICE = '$9'
export const PREMIUM_PERIOD = 'one-time'

export const BUY_ME_A_COFFEE = 'https://buymeacoffee.com/yavro'

// Affiliate / partner links shown in the upgrade dialog support section.
export const AFFILIATE_LINKS: { label: string; url: string; note: string }[] = [
  {
    label: 'Buy me a coffee',
    url: BUY_ME_A_COFFEE,
    note: 'Fuel development — one coffee at a time',
  },
  {
    label: 'desiredsolutions.me',
    url: 'https://desiredsolutions.me',
    note: 'More tools from the maker',
  },
]

export const FREE_LIMITS = {
  exportsPerDay: 3,
  aiRunsPerDay: 3,
  watermark: 'Made with Evoforge PDF — free plan',
}

// Only "Local AI summaries" count against FREE_LIMITS.aiRunsPerDay. PII scan and
// form-field detection are intentionally always free on both plans — scanning your
// own PDF for personal data shouldn't require a paid plan.
export const PLAN_FEATURES: { label: string; free: string | boolean; premium: string | boolean }[] = [
  { label: 'Full editor (draw, highlight, text, shapes)', free: true, premium: true },
  { label: 'Signatures & image stamps', free: true, premium: true },
  { label: 'Page reorder, rotate, delete, merge', free: true, premium: true },
  { label: 'Exports per day', free: `${FREE_LIMITS.exportsPerDay} (watermarked)`, premium: 'Unlimited, clean' },
  { label: 'Local AI summaries per day', free: `${FREE_LIMITS.aiRunsPerDay}`, premium: 'Unlimited' },
  { label: 'PII scan & one-click redaction — always free', free: true, premium: true },
  { label: 'Form-field detection — always free', free: true, premium: true },
  { label: 'Session restore (pick up where you left off)', free: true, premium: true },
  { label: 'Support the maker badge', free: false, premium: true },
]
