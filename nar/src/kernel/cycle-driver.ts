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

export const driveCycles = async (
  run: (steps: number, signal?: AbortSignal) => Promise<number>,
  cycles: number,
  autonomy: AutonomyClock,
  signal?: AbortSignal
): Promise<number> => {
  if (autonomy.enabled && autonomy.mode !== 'manual') {
    throw new Error(`kernel is in autonomous '${autonomy.mode}' mode; the heartbeat drives cycles`);
  }
  let ran = 0;
  for (let i = 0; i < cycles; i++) {
    if (signal?.aborted) break;
    await run(1, signal);
    ran++;
  }
  return ran;
};
