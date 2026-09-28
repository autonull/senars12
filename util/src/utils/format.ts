/**
 * Human-readable formatting for CLI reports, tuning output, and log lines —
 * the single implementation of percent, rule, and progress-bar rendering.
 */

/** Fraction → percentage string (`pct(0.6123)` → `'61.2%'`). */
export const pct = (fraction: number, digits = 1): string =>
  `${(fraction * 100).toFixed(digits)}%`;

/** Horizontal rule separating report sections. */
export const divider = (width = 50): string => '─'.repeat(width);

/** Section banner: rule, title, rule. */
export const section = (title: string, width = 50, rule = '='): string =>
  `\n${rule.repeat(width)}\n${title}\n${rule.repeat(width)}`;

/** Unicode progress bar for a 0–1 fraction. */
export const bar = (fraction: number, width = 20): string => {
  const filled = Math.min(width, Math.round(fraction * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};
