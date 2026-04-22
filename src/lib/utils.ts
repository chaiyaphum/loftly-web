import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn-style class merger. Combines clsx + tailwind-merge so later Tailwind
 * classes win over earlier ones even when both target the same utility axis.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * THB formatter per BRAND.md §3 (canonical): `฿80,000` glyph + comma
 * thousands. `UI_WEB.md §i18n`'s older "THB prefix" note is superseded.
 */
export function formatTHB(value: number): string {
  const formatter = new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 0,
  });
  return `฿${formatter.format(value)}`;
}
