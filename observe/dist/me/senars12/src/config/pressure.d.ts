/**
 * One occupancy ladder for every bounded store that reports pressure — the
 * concept store, the task bags, and eviction. They all measure the same
 * quantity (`occupancy`, 0..1), so four rungs spelled four times with four
 * different values meant eviction, telemetry and health could disagree about
 * whether the system was under pressure at the same instant.
 *
 * `NEUTRAL` is the baseline eviction scales its batch sizes from, not a
 * threshold: it is the occupancy at which an archive/forget batch is zero.
 *
 * Lives in `util` so the general-purpose AIKR bag can read the same rungs the
 * cognitive stores do; `nar` re-exports it from its own constants.
 */
export declare const PRESSURE: Readonly<{
    readonly NEUTRAL: 0.5;
    readonly HIGH: 0.7;
    readonly ARCHIVE: 0.8;
    readonly CRITICAL: 0.9;
}>;
//# sourceMappingURL=pressure.d.ts.map