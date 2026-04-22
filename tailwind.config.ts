import type { Config } from 'tailwindcss';

/**
 * Loftly design tokens. Canonical source: UI_REDESIGN_BRIEF.md §5 + §6.
 *
 * Tokens are wired as CSS-variable references so dark-mode is a v1.1
 * token swap (see src/app/globals.css `:root` vs `.dark`). Never hardcode
 * hex in components — use the `loftly-*` token or a shadcn neutral scale.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Canonical Loftly palette (brief §5) ---
        'loftly-teal': 'rgb(var(--loftly-teal) / <alpha-value>)',
        'loftly-teal-hover': 'rgb(var(--loftly-teal-hover) / <alpha-value>)',
        'loftly-teal-soft': 'rgb(var(--loftly-teal-soft) / <alpha-value>)',
        'loftly-ink': 'rgb(var(--loftly-ink) / <alpha-value>)',
        'loftly-ink-muted': 'rgb(var(--loftly-ink-muted) / <alpha-value>)',
        'loftly-amber': 'rgb(var(--loftly-amber) / <alpha-value>)',
        'loftly-amber-urgent': 'rgb(var(--loftly-amber-urgent) / <alpha-value>)',
        'loftly-warm-white': 'rgb(var(--loftly-warm-white) / <alpha-value>)',
        'loftly-surface': 'rgb(var(--loftly-surface) / <alpha-value>)',
        'loftly-divider': 'rgb(var(--loftly-divider) / <alpha-value>)',
        'loftly-success': 'rgb(var(--loftly-success) / <alpha-value>)',
        'loftly-danger': 'rgb(var(--loftly-danger) / <alpha-value>)',
        'loftly-charcoal': 'rgb(var(--loftly-charcoal) / <alpha-value>)',
        'loftly-charcoal-elev': 'rgb(var(--loftly-charcoal-elev) / <alpha-value>)',

        // --- Legacy aliases (migrating phase-by-phase; do not add new usage) ---
        // `loftly-sky` previously held a wrong sky-blue hex; remapped to teal
        // so pre-migration callsites no longer clash with the brand palette.
        'loftly-sky': 'rgb(var(--loftly-teal) / <alpha-value>)',
        'loftly-baht': 'rgb(var(--loftly-teal) / <alpha-value>)',
        'loftly-consent': 'rgb(var(--loftly-amber) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-noto-thai)', 'system-ui', 'sans-serif'],
        thai: ['var(--font-noto-thai)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Brief §6 fluid type scale — clamp(min, preferred, max).
        'display-xl': ['clamp(2.5rem, 5vw + 1rem, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        display: ['clamp(2rem, 3vw + 1rem, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-lg': ['clamp(1.5rem, 1.5vw + 1rem, 2rem)', { lineHeight: '1.2', fontWeight: '600' }],
        heading: ['clamp(1.25rem, 1vw + 0.75rem, 1.5rem)', { lineHeight: '1.25', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
        // Numeric tokens — compose with `font-mono` for JetBrains Mono (brief §6).
        'numeric-hero': ['clamp(2.5rem, 3vw + 1rem, 3.5rem)', { lineHeight: '1', fontWeight: '700' }],
        'numeric-table': ['clamp(0.9375rem, 0.2vw + 0.875rem, 1rem)', { lineHeight: '1.4' }],
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '16px',
        full: '9999px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgb(30 42 58 / 0.04)',
        'DEFAULT': '0 2px 8px -2px rgb(30 42 58 / 0.08), 0 1px 3px -1px rgb(30 42 58 / 0.06)',
        'elevated': '0 12px 32px -8px rgb(30 42 58 / 0.14), 0 4px 12px -4px rgb(30 42 58 / 0.08)',
      },
      keyframes: {
        'loftly-pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.85)' },
        },
      },
      animation: {
        'loftly-pulse-dot': 'loftly-pulse-dot 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
