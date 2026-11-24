/**
 * `senars doctor --benchmarks` — the costly-derivation report (CORE.19 C7.6).
 *
 * The earlier placeholder returned `[]`; this runs a fixed, LM-free reasoning
 * workload on a bare kernel and ranks the rule fires it actually produced by the
 * cost they measured. The data is real (the `rule:applied` events' own `cpuMs`
 * and `duration`), never simulated — D15 keeps `[]` honest and this keeps it useful.
 */
import { createBotNAR } from '../../agent/index';

/** One ranked group of rule fires, keyed by rule and conclusion. */
export interface DerivationCost {
  conclusion: string;
  rule: string;
  calls: number;
  cpuMs: number;
  durationMs: number;
}

/** A deterministic syllogism chain — no LM, so the run is a kernel measurement. */
const BENCH_BELIEFS = [
  '<a-->b>. %1.0;0.9%',
  '<b-->c>. %1.0;0.9%',
  '<c-->d>. %1.0;0.9%',
  '<d-->e>. %1.0;0.9%',
  '<e-->f>. %1.0;0.9%',
] as const;
const BENCH_QUESTION = '<a-->f>?';

export interface BenchmarkOptions {
  /** Inference cycles to run the workload for. Default 24. */
  cycles?: number;
  /** Rows to return, costliest first. Default 10. */
  limit?: number;
}

export async function runDerivationBenchmarks(
  options: BenchmarkOptions = {}
): Promise<DerivationCost[]> {
  const nar = createBotNAR();
  const costs = new Map<string, DerivationCost>();
  // Note: NAREventMap import removed - using inline type
  const unsubscribe = nar.getSystemEventBus().on('rule:applied', (e: unknown) => {
    const event = e as { ruleId: string; conclusion: unknown; cpuMs?: number; duration?: number };
    const key = `${event.ruleId}\u0000${String(event.conclusion)}`;
    const row = costs.get(key) ?? {
      conclusion: String(event.conclusion),
      rule: event.ruleId,
      calls: 0,
      cpuMs: 0,
      durationMs: 0,
    };
    row.calls++;
    row.cpuMs += event.cpuMs ?? 0;
    row.durationMs += event.duration ?? 0;
    costs.set(key, row);
  });
  try {
    await nar.run(1);
    for (const belief of BENCH_BELIEFS) await nar.believe(belief);
    await nar.question(BENCH_QUESTION);
    await nar.run(options.cycles ?? 24);
  } finally {
    unsubscribe();
    await nar.dispose();
  }
  return [...costs.values()]
    .sort((a, b) => b.cpuMs - a.cpuMs || b.durationMs - a.durationMs || b.calls - a.calls)
    .slice(0, options.limit ?? 10);
}