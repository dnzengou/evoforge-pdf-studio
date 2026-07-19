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

### PII scanner — best-effort, not exhaustive

The "Redact" tab runs regex patterns over each page's extracted text layer. Detection depends on how the PDF encodes that text:

- **Scanned images** have no text layer. A scanned driver's licence returns zero hits. OCR is not yet built in — treat any zero-hit result on a scanned page as "unknown", not "clean".
- **Custom glyph encodings** (some fonts subset with private-use codepoints, some engines emit unmapped CIDs) can extract as garbled characters and won't match the patterns.
- **Vector-drawn text** (logos, some watermarks) has no text layer at all.
- **Split runs**: pdf.js emits text as runs broken at font/kerning boundaries. The scanner concatenates runs before matching so a value like `555-` + `123-4567` still triggers, but a run split *inside* the character the regex needs to see (e.g. a run boundary where a required space would go, in a pattern that requires whitespace) can still hide a match.

Treat the scan as a first pass, not a compliance certification. For hard cases, use the Redact tool to draw redaction boxes manually — the export burns those boxes into the rasterised page, so the underlying text is deleted, not merely hidden.

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
