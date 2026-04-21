import type { Config } from 'tailwindcss';

/**
 * Loftly brand tokens.
 * IMPORTANT: the hex values below are PLACEHOLDERS. Final palette is TBD —
 * the designer will lock these against `BRAND.md §5` in Phase 1 Week 2.
 * Until then, `loftly-sky` roughly traces the "loft/sky" metaphor and the
 * other three are semantic slots for ink (text), baht (THB numeric accent),
 * and consent (compliance/trust moments).
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'loftly-sky': '#0ea5e9',      // placeholder — sky/loft token
        'loftly-ink': '#0f172a',      // placeholder — primary text
        'loftly-baht': '#1d9e75',     // placeholder — THB numeric accent (warm teal per BRAND.md)
        'loftly-consent': '#ef9f27',  // placeholder — compliance/trust (amber per BRAND.md)
      },
      fontFamily: {
        // Wired up in src/app/layout.tsx via next/font; these keep Tailwind classes working.
        sans: ['var(--font-inter)', 'var(--font-noto-thai)', 'system-ui', 'sans-serif'],
        thai: ['var(--font-noto-thai)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // 4/8/12/16/24/32/48/64 scale from UI_WEB.md §Design tokens
      },
    },
  },
  plugins: [],
};

export default config;
