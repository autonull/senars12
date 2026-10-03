/**
 * Human-readable formatting for CLI reports, tuning output, and log lines —
 * the single implementation of percent, rule, and progress-bar rendering.
 */

import { clamp } from './numeric.js';

/** Fraction → percentage string (`pct(0.6123)` → `'61.2%'`). */
export const pct = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`;

/** Horizontal rule separating report sections. */
export const divider = (width = 50): string => '─'.repeat(width);

/** Section banner: rule, title, rule. */
export const section = (title: string, width = 50, rule = '='): string =>
  `\n${rule.repeat(width)}\n${title}\n${rule.repeat(width)}`;

/**
 * Percentile of an unsorted sample at index `floor(p * n)`, clamped; 0 for an empty one.
 * `p` is a fraction: `percentile(xs, 0.95)` is the 95th percentile, so a caller
 * holding a 0–100 `p` must divide by 100 rather than pass it through.
 *
 * This is `floor`, not the nearest-rank `ceil(p * n) - 1`, so on an even-sized
 * sample p50 reads the upper of the two middle values.
 */
export const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[clamp(Math.floor(sorted.length * p), 0, sorted.length - 1)] ?? 0;
};

/** UTC calendar day as `YYYY-MM-DD` — the one date key for daily ledger files. */
export const utcDate = (at: number | Date = Date.now()): string =>
  new Date(at).toISOString().slice(0, 10);

/** Unicode progress bar for a 0–1 fraction. */
export const bar = (fraction: number, width = 20): string => {
  const filled = Math.min(width, Math.round(fraction * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};
