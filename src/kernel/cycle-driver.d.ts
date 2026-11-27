/**
 * The kernel-owned cycle driver (CORE.19 C2.1/C5.2). One loop, extracted from the
 * facade so `nar.ts` stays under its monolith budget, that advances the kernel
 * one cycle at a time and refuses while an autonomous mode owns the clock — the
 * heartbeat is then the single driver, and an external loop would race it.
 */
/** The autonomy facts the refusal reads; only these two fields matter here. */
export interface AutonomyClock {
    enabled: boolean;
    mode: string;
}
export declare const driveCycles: (run: (steps: number, signal?: AbortSignal) => Promise<number>, cycles: number, autonomy: AutonomyClock, signal?: AbortSignal) => Promise<number>;
//# sourceMappingURL=cycle-driver.d.ts.map