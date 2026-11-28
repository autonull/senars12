/**
 * Human-readable formatting for CLI reports, tuning output, and log lines —
 * the single implementation of percent, rule, and progress-bar rendering.
 */
/** Fraction → percentage string (`pct(0.6123)` → `'61.2%'`). */
export declare const pct: (fraction: number, digits?: number) => string;
/** Horizontal rule separating report sections. */
export declare const divider: (width?: number) => string;
/** Section banner: rule, title, rule. */
export declare const section: (title: string, width?: number, rule?: string) => string;
/**
 * Percentile of an unsorted sample at index `floor(p * n)`, clamped; 0 for an empty one.
 * `p` is a fraction: `percentile(xs, 0.95)` is the 95th percentile, so a caller
 * holding a 0–100 `p` must divide by 100 rather than pass it through.
 *
 * This is `floor`, not the nearest-rank `ceil(p * n) - 1`, so on an even-sized
 * sample p50 reads the upper of the two middle values.
 */
export declare const percentile: (values: readonly number[], p: number) => number;
/**
 * Several percentiles of one sample from a single sort. A caller reading two
 * terciles off the same array paid for two copies and two sorts of it; the
 * definition of the percentile is unchanged, so this is {@link percentile}
 * applied once to a list.
 */
export declare const percentiles: (values: readonly number[], ps: readonly number[]) => number[];
/** UTC calendar day as `YYYY-MM-DD` — the one date key for daily ledger files. */
export declare const utcDate: (at?: number | Date) => string;
/** Unicode progress bar for a 0–1 fraction. */
export declare const bar: (fraction: number, width?: number) => string;
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
export declare function formatDuration(ms: number): string;
/**
 * Bytes → `1.4MB`. The previous spelling was `existsSync(p) ? \`${statSync(p).size}B\``
 * at four sites, which prints `1234567B` for a dataset a reader has to divide in
 * their head. Integral bytes print without a decimal (`512B`, not `512.0B`) so
 * sizes stay comparable at a glance.
 */
export declare function formatBytes(bytes: number): string;
//# sourceMappingURL=format.d.ts.map