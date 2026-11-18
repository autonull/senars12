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
export const percentile = (values: readonly number[], p: number): number =>
  percentiles(values, [p])[0] ?? 0;

/**
 * Several percentiles of one sample from a single sort. A caller reading two
 * terciles off the same array paid for two copies and two sorts of it; the
 * definition of the percentile is unchanged, so this is {@link percentile}
 * applied once to a list.
 */
export const percentiles = (values: readonly number[], ps: readonly number[]): number[] => {
  if (values.length === 0) return ps.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return ps.map((p) => sorted[clamp(Math.floor(sorted.length * p), 0, sorted.length - 1)] ?? 0);
};

/** UTC calendar day as `YYYY-MM-DD` — the one date key for daily ledger files. */
export const utcDate = (at: number | Date = Date.now()): string =>
  new Date(at).toISOString().slice(0, 10);

/** Unicode progress bar for a 0–1 fraction. */
export const bar = (fraction: number, width = 20): string => {
  const filled = Math.min(width, Math.round(fraction * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};

/**
 * Milliseconds → the shortest honest unit. A latency table that renders every
 * row in the unit of its largest row is unreadable at the sub-millisecond end,
 * and every hand-rolled site had to pick that unit for itself — `toFixed(0)ms`
 * for a 400µs inference step prints `0ms`, which reads as "free" rather than
 * "fast".
 *
 * Sub-millisecond values keep three significant decimals because that is the
 * whole range where the unit alone is lossy (`0.4ms`, not `0ms`). Whole units get
 * one decimal, so a column stays scannable. `Infinity` renders as `-` rather
 * than `Infinityms`.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1) return `${ms.toFixed(3)}ms`;
  return ms < 1000 ? `${ms.toFixed(1)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Bytes → `1.4MB`. The previous spelling was `existsSync(p) ? \`${statSync(p).size}B\``
 * at four sites, which prints `1234567B` for a dataset a reader has to divide in
 * their head. Integral bytes print without a decimal (`512B`, not `512.0B`) so
 * sizes stay comparable at a glance.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)}${BYTE_UNITS[unit]}`;
}
