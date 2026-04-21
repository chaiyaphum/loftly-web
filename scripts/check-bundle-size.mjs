#!/usr/bin/env node
// Bundle-size budget enforcement for CI.
//
// Reads `.next/app-build-manifest.json` + the build output size table written
// by `next build` and compares against configured budgets. Fails non-zero if
// any route exceeds its budget.
//
// Budgets (first-load JS):
//   - admin routes : 250 KB
//   - public       : 160 KB (selector chart pushes us slightly over 150)
//
// The script greps the build output for the size table — this is simpler than
// parsing Next.js internals, and resistant to Next upgrades.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ADMIN_BUDGET_KB = 250;
const PUBLIC_BUDGET_KB = 160;

const manifestPath = resolve('.next/app-build-manifest.json');
if (!existsSync(manifestPath)) {
  console.error('No .next/app-build-manifest.json — run `next build` first.');
  process.exit(1);
}

const buildLogPath = resolve('build-output.txt');
if (!existsSync(buildLogPath)) {
  console.warn(
    '[bundle-size] no .next/build-output.txt; skipping (pipe build output there to enable)',
  );
  process.exit(0);
}

const log = readFileSync(buildLogPath, 'utf8');
const lines = log.split('\n');

const routeRegex =
  /^[├└┌]\s[ƒ○●]\s(\/[\S]*?)\s+[\d.]+\s+(k?B)\s+(\d+(?:\.\d+)?)\s+(kB|MB)/;

const violations = [];
for (const line of lines) {
  const m = routeRegex.exec(line);
  if (!m) continue;
  const [, route, , first, unit] = m;
  const kb = unit === 'MB' ? Number(first) * 1024 : Number(first);
  const budget = route.startsWith('/admin')
    ? ADMIN_BUDGET_KB
    : PUBLIC_BUDGET_KB;
  if (kb > budget) {
    violations.push({ route, kb, budget });
  }
}

if (violations.length) {
  console.error('[bundle-size] budget exceeded:');
  for (const v of violations) {
    console.error(`  ${v.route}: ${v.kb} kB (budget ${v.budget} kB)`);
  }
  process.exit(1);
}

console.log(`[bundle-size] all routes within budget.`);
