# Evoforge PDF Studio — Blueprint

Client-side PDF editor with local AI. Ships as a static SPA. No backend, no upload endpoint.

## Current version: 0.2.0 (2026-07-18)

## Stack

- Vite 7 · React 19 · TypeScript 5.9 · Tailwind 3.4 · shadcn/ui
- pdfjs-dist (render) · pdf-lib (export) · zustand (state) · react-router 7
- Deploy: static (netlify.toml scaffolded)

## Shipping principles (inherited)

- **KafCa RRSS** — Robust (circuit breaker on export path) · Reliable (Q-gate: lint + build + smoke) · Solid (production scheduler; no half-measures) · Systematic (BLUEPRINT + lineage on every ship)
- **CI-truth** (kafcade v2.3) — no `continue-on-error: true`, no `--no-verify`, no silenced type errors
- **Verify-before-ship** (evo-metaclaw v1.4) — `npm run lint && npm run build && npx tsx test/smoke.ts` before every commit
- **Header verify after push** (evo-metaclaw v1.4) — `curl -sI <origin>` and grep for the six security headers
- **Subtractive-first** (evo-metaclaw v1.4) — before adding surface, scan for surface without traffic
- **First-B-checks-.github/** (evo-metaclaw v1.5) — a repo with no CI / SAST / Dependabot / SECURITY.md is shipping insecure

## Architecture

```
index.html
└── src/main.tsx
    └── src/App.tsx (react-router)
        └── src/pages/Home.tsx
            ├── src/components/TopBar.tsx        — toolbar, file open, export, upgrade CTA
            ├── src/components/ThumbRail.tsx     — page thumbnails, drag-reorder
            ├── src/components/EditorArea.tsx    — main canvas host
            │   └── src/components/PageView.tsx  — per-page canvas + SVG overlay
            │       └── src/components/AnnotationSvg.tsx
            ├── src/components/SidePanel.tsx     — AI + search + PII scan
            ├── src/components/FooterSig.tsx
            └── src/components/UpgradeDialog.tsx — Stripe link + affiliates + plan compare
```

State: `src/store.ts` (zustand). Model types: `src/types.ts`. PDF engines: `src/lib/pdfEngine.ts` (render), `src/lib/exportPdf.ts` (flatten). AI: `src/lib/aiTools.ts`. Persistence: `src/lib/persistence.ts` (IndexedDB). Entitlement: `src/lib/entitlement.ts`. Config: `src/config/monetization.ts`.

## Roadmap

### ✅ v0.2.0 (2026-07-18) — Security defaults + prod hygiene

- `.github/workflows/ci.yml` — lint + build + smoke on push/PR (Node 20, npm cache, cancel-in-progress)
- `.github/workflows/codeql.yml` — JS/TS SAST (security-and-quality queries) weekly + on PR
- `.github/dependabot.yml` — weekly npm + github-actions updates, grouped (radix / react / pdf / lint / types / vite)
- `.github/SECURITY.md` — threat model + advisory reporting + honest client-side unlock caveat
- `netlify.toml` — CSP · HSTS · Permissions-Policy · X-Frame-Options · X-Content-Type-Options · Referrer-Policy · COOP · CORP · SPA fallback · asset immutable cache
- `package.json` — name "my-app" → "evoforge-pdf-studio", version "0.0.0" → "0.2.0"
- README — CI/CodeQL/License/client-side badges + threat model paragraph

### v0.3.0 candidates (ranked by orthogonal-win count)

- **URL-state for view + tool** (3 wins: shareable state, analytics granularity, PWA shortcut alignment) — sync `?tool=&page=` to URL via `replaceState`
- **Compare mode** (1 win: workflow) — two documents side-by-side
- **OCR (client-side Tesseract)** (2 wins: scanned-PDF unlock, extractive AI works on more docs) — bundle cost is real, gate behind a lazy chunk
- **Real Stripe webhook + signed unlock token** (1 win: honest licence) — requires a serverless function; changes deployment shape

### Not planned

- Server-side rendering / upload
- Telemetry beacons
- External AI API integration (would break "no keys, no network" promise)

## Fitness gates

Every merge to main must:

1. `npm run lint` — zero errors, zero warnings
2. `npm run build` — succeeds, bundle delta reported in the commit message if > 5 KB gzipped
3. `npx tsx test/smoke.ts` — all assertions pass
4. Post-deploy: `curl -sI <origin>` returns all six security headers

## Consulted skill versions (2026-07-18)

- evo-metaclaw v1.8 — POLISH-PASS Q-gate, SHAREABLE-DEEP-LINK, BOILERPLATE-STACK-MISMATCH, FIRST-B-CHECKS-.github/, E-B PARALLEL COMMIT HOLD
- evo-forge v1.2 — POLISH-PASS Q-gate contract, URL-state as canonical, STATIC-SPA as first-class deployment target
- kafcade heritage — CI-truth, version-harmony grep, security-defaults language substitution map (JS/TS → CodeQL)

## Lineage

```
v0.2.0 (2026-07-18) ← CURRENT
  Cascade: B+P+D+Ci+E+Bl for evoforge-pdf-studio
  - FIRST-B-CHECKS-.github/ rule fired on empty .github/ tree → shipped
    security-defaults bundle in the same commit as name/version bump
    and netlify.toml scaffold
  - PATCH-vs-MINOR-vs-MAJOR discrimination: this is MINOR because it adds
    surface (CI + SAST + Dependabot + SECURITY.md + netlify.toml + README
    threat-model paragraph), even though no app features shifted
  - Consulted evo-metaclaw v1.8 (FIRST-B-CHECKS + E-B parallel) and
    evo-forge v1.2 (STATIC-SPA-first-class-target) at session start;
    no rediscovery of prior lessons
```
