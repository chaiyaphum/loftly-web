# Performance Budgets

Loftly enforces two kinds of performance budgets in CI:

1. **Static bundle budgets** (`size-limit`) — fail the build if JS chunks
   exceed configured gzipped sizes.
2. **Runtime performance budgets** (`@lhci/cli` + Lighthouse) — fail the
   build if real-browser metrics (LCP, CLS, FID) regress beyond thresholds.

Both run on every PR and on pushes to `main`. The workflow is
`.github/workflows/perf-budget.yml`.

## Why these thresholds

The MVP's target user runs on **mid-tier Thai mobile** (3G/4G, ~1.5 Mbps,
150 ms RTT) on a device roughly 4x slower than a desktop reference.
`/mvp/DEV_PLAN.md` W14 requires **LCP < 2.5s on 3G**. The Lighthouse
config emulates those conditions (`cpuSlowdownMultiplier: 4`, `rttMs:
150`, ~1.6 Mbps down).

### Lighthouse category thresholds

| Category        | Minimum score |
| --------------- | ------------- |
| Performance     | 85            |
| Accessibility   | 95            |
| Best Practices  | 90            |
| SEO             | 90            |

### Core Web Vitals

| Metric | Budget  | Source                   |
| ------ | ------- | ------------------------ |
| LCP    | 2500 ms | DEV_PLAN W14, Google CWV |
| CLS    | 0.1     | Google CWV "good"        |
| FID    | 100 ms  | Google CWV "good"        |
| (Max Potential FID is a Lighthouse proxy for real FID.) |

### Bundle size budgets

See `.size-limit.json`. Derived from the current production build (see
`build-output.txt`):

| Entry                     | Budget (gz) | Current (gz) | Rationale                              |
| ------------------------- | ----------- | ------------ | -------------------------------------- |
| Framework chunk           | 60 KB       | ~57.5 KB     | React + Next runtime; ~5% headroom     |
| Main chunk                | 40 KB       | ~34.0 KB     | Next main entry                        |
| Webpack runtime           | 10 KB       |  ~1.7 KB     | Small runtime module                   |
| Polyfills                 | 45 KB       | ~39.5 KB     | Mostly core-js                         |
| Shared vendor chunks      | 175 KB      | ~156.6 KB    | All `.next/static/chunks/[0-9]*-*.js`  |
| Per-route page chunk      | 20 KB       | ~0–12 KB     | Tightest route = biggest current room  |

First Load JS per route is additionally enforced by
`scripts/check-bundle-size.mjs` (invoked by `ci.yml`) — admin ≤ 250 KB,
public ≤ 160 KB.

## Running locally

```sh
# Build with bundle analyzer — opens HTML reports in .next/analyze/
npm run analyze

# Enforce bundle budgets
npm run size

# Full Lighthouse run (boots next start on localhost:3000)
npm run build
npm run lighthouse
```

## When CI fails

### size-limit fails

1. Run `npm run analyze` locally.
2. Open `.next/analyze/client.html` and identify what ballooned.
3. Common fixes:
   - Lazy-load heavy components with `next/dynamic`
   - Check for duplicate deps (`npm ls <pkg>`)
   - Avoid barrel imports pulling entire libraries
   - Swap a heavy dep for a lighter one
4. Re-run `npm run size` until it passes.

### Lighthouse fails

1. Check the Lighthouse report link in the CI logs (uploaded to temporary
   public storage).
2. Open the failing audit in the report — it will identify the specific
   issue (render-blocking CSS, unsized images causing CLS, etc.).
3. Fix the underlying issue, don't raise the threshold without cause.

## Updating budgets

Budget changes are **two-step** PRs:

1. **PR #1**: Ship the feature that legitimately needs the extra budget.
   Include in the PR description:
   - What shipped
   - Why it requires more bytes / time
   - What alternatives were considered
   - Size before / after
2. **PR #2**: Bump the budget number in `.size-limit.json` or
   `.lighthouserc.js`. Link back to PR #1.

This keeps budget drift auditable — every regression has a written
justification.

## Status

- Static bundle budgets — **live** in CI.
- Lighthouse CI — **live** but targeting `localhost:3000` via
  `next start`. Once Cloudflare Pages staging preview URLs exist, swap
  `collect.url` in `.lighthouserc.js` to the preview URL and drop
  `startServerCommand`. See `/mvp/DEV_PLAN.md` for the Pages provisioning
  milestone.

*Last updated: April 2026*
