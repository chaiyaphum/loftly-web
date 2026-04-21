# loftly-web

Web frontend for [Loftly](https://loftly.co.th) — Thai AI-native credit card rewards optimization. Phase 1 MVP.

- **Spec**: see [`../loftly/mvp/README.md`](../loftly/mvp/README.md)
- **Page inventory + wireframes**: [`../loftly/mvp/UI_WEB.md`](../loftly/mvp/UI_WEB.md)
- **Voice / copy rules**: [`../loftly/BRAND.md` §4](../loftly/BRAND.md)
- **Deployment**: Cloudflare Pages — see [`../loftly/mvp/DEPLOYMENT.md`](../loftly/mvp/DEPLOYMENT.md)

## Stack

- Next.js 15 (App Router, React Server Components)
- TypeScript (strict)
- Tailwind CSS + shadcn/ui primitives
- next-intl (Thai default at `/`, English at `/en/*`)
- Vitest (unit), Playwright (E2E, scaffolded)
- Deploys to Cloudflare Pages via `@cloudflare/next-on-pages`

## Prerequisites

- **Node.js 22** (nvm recommended — `nvm use 22`)
- **npm 10+** — this repo uses npm, **not pnpm**

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Next production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (next/core-web-vitals + next/typescript + prettier) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run format` | Prettier write |
| `npm run pages:build` | Build for Cloudflare Pages via next-on-pages |
| `npm run pages:dev` | Run the pages build locally via wrangler |

## Project layout

```
src/
  app/                  # App Router pages + route handlers
    page.tsx              # landing (/)
    selector/             # Card Selector
    cards/                # card reviews
    valuations/           # THB/point valuations
    apply/[card_id]/      # affiliate redirect handler
    onboarding/           # sign-in + PDPA consent
    account/              # authed account mgmt
    legal/                # privacy, terms, affiliate-disclosure
  components/
    ui/                   # shadcn primitives
    loftly/               # Loftly-specific composites
  i18n/                   # next-intl routing + request config
  lib/                    # utilities
messages/                 # th.json, en.json — all user-facing strings
tests/                    # Vitest
```

## Conventions

- All user-facing strings live in `messages/th.json` + `messages/en.json`. Never hardcode Thai/English in JSX.
- Follow the voice rules in `../loftly/BRAND.md` §4 — no buzzwords ("revolutionary", "synergy", …), preserve Thai.
- THB figures use the `THB` prefix, never `฿` (see `UI_WEB.md` §i18n spec).
- Brand names preserved in English (K Point, KrisFlyer, ROP, Marriott Bonvoy).

## Deploy

Cloudflare Pages; the GitHub Actions pipeline in `.github/workflows/ci.yml` runs lint / typecheck / test / build on push and PR. The deploy step is added once Cloudflare credentials are provisioned (see `../loftly/mvp/DEPLOYMENT.md §CI/CD`).
