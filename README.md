# Evoforge PDF Studio

Annotate · Sign · Reorder · Merge · Redact · Summarize — 100% in-browser, nothing uploaded.

A best-in-class, AI-powered PDF editor that runs entirely client-side. No servers, no uploads, no tracking.

## Features

- **Full editor** — pen, highlight, text, rectangle, ellipse, line, arrow, redaction boxes, eraser; select / move / resize; 50-step undo-redo; keyboard shortcuts
- **Signatures & stamps** — draw a signature, click to place; image stamps
- **Page surgery** — drag-reorder thumbnails, rotate, delete, insert blank pages, merge multiple PDFs (drop a second file in)
- **Flattened export** — vector annotations via pdf-lib, rotation-corrected geometry, WinAnsi-safe text
- **Full-text search** — across all pages, jump to hit
- **EvometaClaw local AI** — extractive summaries, keywords, PII scan (email / SSN / phone / card / IBAN / IP) with one-click redaction, AcroForm field detection. No API keys, no network
- **Session restore** — autosaves to IndexedDB; pick up where you left off

## Freemium model

| | Free | Premium ($9 one-time) |
|---|---|---|
| Full editor, signatures, page ops | ✅ | ✅ |
| Exports | 3/day, watermarked | Unlimited, clean |
| Local AI summaries | 3/day | Unlimited |

Premium unlocks via a Stripe Payment Link whose success URL is `/?upgraded=1`.
Configure in `src/config/monetization.ts` (Stripe link, BuyMeACoffee, affiliate links, plan limits).

## Stack

React 19 · TypeScript · Vite · Tailwind · shadcn/ui · pdfjs-dist (render) · pdf-lib (export) · zustand

## Develop

```bash
npm install
npm run dev
```

## Test

```bash
npx tsx test/smoke.ts   # export pipeline, rotation geometry, AI tools
```

## Build

```bash
npm run build           # outputs dist/
```

Made by [desiredsolutions.me](https://desiredsolutions.me) with 💚 & ☕️ — [Buy me a coffee](https://buymeacoffee.com/yavro)
