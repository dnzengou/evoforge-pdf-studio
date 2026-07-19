# Security Policy

## Threat model

Evoforge PDF Studio runs entirely in the browser. There is no backend, no upload endpoint, no analytics beacon, no telemetry.

- **PDF bytes** stay in the tab (`ArrayBuffer` → pdf.js render → pdf-lib export → user download).
- **Session state** persists to the origin's IndexedDB (`evoforge` / `session` store). Local to the browser profile; never transmitted.
- **AI (EvometaClaw)** — summaries, keyword extraction, and PII detection are pure functions over the extracted text. No API keys. No network calls.
- **Payments** — the freemium unlock uses a Stripe Payment Link. The user completes checkout on Stripe's origin and is redirected back with `?upgraded=1`. The app never sees the card data.

### What this means for the user's file

If you don't hit File → Export, nothing leaves the tab. If you do, only your own browser writes the file to your disk.

### What this means for you as the maintainer

The client-side unlock (`localStorage.evo_premium = '1'`) is an honor-system gate. It resists casual tampering but is not a licence check. If you need enforceable licensing, wire a backend webhook against the Stripe `checkout.session.completed` event and issue signed unlock tokens instead.

## Reporting a vulnerability

Please open a private security advisory:

- https://github.com/dnzengou/evoforge-pdf-studio/security/advisories/new

Or email the maintainer via the contact form at https://desiredsolutions.me.

Please include:
- Affected file / line / commit
- Reproduction steps
- Impact (data exfil, XSS, prototype pollution, RCE via crafted PDF, etc.)

We'll acknowledge within 72 hours and aim to ship a fix within 14 days for critical issues.

## Supported versions

Only the latest `main` build served from the deployed origin receives security fixes. There are no backports.

## Content Security Policy

The deployed origin ships a strict CSP (see `netlify.toml`) with no `unsafe-eval`, `object-src 'none'`, and `frame-ancestors 'none'`. Any patch that requires loosening the CSP must be justified in the PR description.
