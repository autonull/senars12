import type { AutonomyConfig } from './config';
import type { AutonomyPorts, AutonomyTickReport } from './types';
/**
 * The kernel-owned autonomy loop (CORE.19 C5.1/C5.2). One heartbeat, bounded by
 * a cycle budget and a wall-clock window, that (per tick) advances the kernel
 * and evaluates the enabled policies — curiosity and consolidation — under
 * store backpressure. Every behavior carries provenance on the one bus, and
 * every behavior has an off switch (D16).
 *
 * The heartbeat never advances the kernel past its window budget: a runaway loop
 * halts itself and says why rather than spinning.
 */
export declare class AutonomyHeartbeat {
    #private;
    readonly config: AutonomyConfig;
    constructor(config: AutonomyConfig, ports: AutonomyPorts);
    isRunning(): boolean;
    /**
     * One unit of autonomous work: advance the kernel (if the window budget
     * allows) and evaluate the enabled policies. Independent of `mode` — the mode
     * only decides *who* calls this (`stepping` a caller, `continuous` the
     * interval); the work is the same and observable either way.
     */
    tick(): Promise<AutonomyTickReport>;
    /**
     * Interval-driven mode (`continuous`). A no-op unless autonomy is enabled and
     * the mode is `continuous` — `stepping` is caller-driven, `manual` is off.
     */
    start(): void;
    stop(): void;
}
//# sourceMappingURL=heartbeat.d.ts.map