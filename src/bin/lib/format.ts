/** Shared human-readable formatting for CLI reports and tuners. */

/** Fraction → percentage string (`pct(0.6123)` → `'61.2%'`). */
export const pct = (fraction: number, digits = 1): string =>
  `${(fraction * 100).toFixed(digits)}%`;

/** Horizontal rule separating report sections. */
export const divider = (width = 50): string => '─'.repeat(width);

/** Unicode progress bar for a 0–1 fraction. */
export const bar = (fraction: number, width = 20): string => {
  const filled = Math.min(width, Math.round(fraction * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};
