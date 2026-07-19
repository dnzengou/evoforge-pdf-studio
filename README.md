# Evoforge PDF Studio

[![CI](https://github.com/dnzengou/evoforge-pdf-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/dnzengou/evoforge-pdf-studio/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dnzengou/evoforge-pdf-studio/actions/workflows/codeql.yml/badge.svg)](https://github.com/dnzengou/evoforge-pdf-studio/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![100%25 client-side](https://img.shields.io/badge/100%25-client--side-emerald)](.github/SECURITY.md)

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
| PII scan & one-click redaction | ✅ always free | ✅ |
| Form-field detection | ✅ always free | ✅ |

Only the summary generator counts against the daily AI cap. Scanning your own PDF for PII or detecting form fields is unlimited on both plans — privacy tooling shouldn't sit behind a paywall.

Premium unlocks via a Stripe Payment Link whose success URL is `/?upgraded=1`.
Configure in `src/config/monetization.ts` (Stripe link, BuyMeACoffee, affiliate links, plan limits).

## Threat model

Your PDF never leaves the tab. See [SECURITY.md](.github/SECURITY.md) for the full posture:
- No backend, no upload endpoint, no telemetry.
- Session state persists to the browser's IndexedDB only.
- The AI layer is pure functions over extracted text — no API keys, no network calls.
- The deployed origin ships a strict CSP (no `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`).

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

## Deploy

Netlify config (`netlify.toml`) ships strict security headers (CSP · HSTS · Permissions-Policy · X-Frame-Options · X-Content-Type-Options · Referrer-Policy · COOP · CORP) and a SPA fallback. Point Netlify at the repo and it will pick up the config.

Made by [desiredsolutions.me](https://desiredsolutions.me) with 💚 & ☕️ — [Buy me a coffee](https://buymeacoffee.com/yavro)
