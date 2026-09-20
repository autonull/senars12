/**
 * F3: System One on/off measurement — token-reduction (LM calls/spend) and
 * cycle-latency deltas over a synthetic utterance workload. The mock leg runs
 * offline-deterministically (CI-safe); real-provider legs need a model-cached
 * machine (`LM_PROVIDER=ollama|llamacpp pnpm bench:system-one`).
 *
 * Usage:
 *   pnpm bench:system-one            # mock leg → .reports/system-one-onoff.{json,md}
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SeNARSFactory } from '../nar/src/factory.js';

const UTTERANCES = [
  'the robin is a bird',
  'birds can fly',
  'what is the capital of France?',
  'run the deployment tool now!',
  'I think water is wet',
  'cats chase mice',
  'is the model trained yet?',
  'please summarize the trace',
  'the sun is a star',
  'trade execution completed at 14:32',
];

const CYCLES_PER_UTTERANCE = 3;

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
};

interface LegResult {
  enabled: boolean;
  totalMs: number;
  p50Ms: number;
  p99Ms: number;
  parseFailures: number;
  lmCalls: number;
  tokensIn: number;
  tokensOut: number;
  costMilli: number;
  judgmentsEmitted: number;
}

async function runLeg(enabled: boolean): Promise<LegResult> {
  const nar = SeNARSFactory.createDefault({
    systemOne: { enabled },
    maxConcepts: 2000,
  });

  const eventBus = nar.getSystemEventBus();
  let judgments = 0;
  eventBus.on('judgment.resolved', () => judgments++);

  const latencies: number[] = [];
  let parseFailures = 0;
  for (let cycle = 0; cycle < CYCLES_PER_UTTERANCE; cycle++) {
    for (const utterance of UTTERANCES) {
      const start = performance.now();
      try {
        await nar.input(utterance);
      } catch {
        parseFailures++; // Tier-0 parse rejects non-Narsese — counted, not fatal
      }
      latencies.push(performance.now() - start);
    }
  }

  const spend = Object.values(nar.getLMClient?.()?.getSpend() ?? {}).reduce(
    (acc, s) => ({
      calls: acc.calls + s.calls,
      tokensIn: acc.tokensIn + s.tokensIn,
      tokensOut: acc.tokensOut + s.tokensOut,
      costMilli: acc.costMilli + s.costMilli,
    }),
    { calls: 0, tokensIn: 0, tokensOut: 0, costMilli: 0 }
  );

  const result: LegResult = {
    enabled,
    totalMs: latencies.reduce((a, b) => a + b, 0),
    p50Ms: percentile(latencies, 50),
    p99Ms: percentile(latencies, 99),
    parseFailures,
    lmCalls: spend.calls,
    tokensIn: spend.tokensIn,
    tokensOut: spend.tokensOut,
    costMilli: spend.costMilli,
    judgmentsEmitted: judgments,
  };
  await nar.dispose();
  return result;
}

const on = await runLeg(true);
const off = await runLeg(false);

const report = {
  generatedAt: new Date().toISOString(),
  provider: process.env.LM_PROVIDER ?? 'default',
  workload: { utterances: UTTERANCES.length, cyclesPerUtterance: CYCLES_PER_UTTERANCE },
  systemOneOn: on,
  systemOneOff: off,
  delta: {
    p99DeltaMs: on.p99Ms - off.p99Ms,
    lmCallDelta: on.lmCalls - off.lmCalls,
    tokenDelta: on.tokensIn + on.tokensOut - (off.tokensIn + off.tokensOut),
    judgmentOverhead: on.judgmentsEmitted,
  },
};

const dir = join(process.cwd(), '.reports');
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'system-one-onoff.json'), JSON.stringify(report, null, 2));
const md = [
  '# System One on/off measurement (F3)',
  '',
  `Generated: ${report.generatedAt} · provider: ${report.provider}`,
  '',
  '| Metric | System One ON | OFF | Δ |',
  '|--------|--------------:|----:|---:|',
  `| P50 input latency (ms) | ${on.p50Ms.toFixed(2)} | ${off.p50Ms.toFixed(2)} | ${(on.p50Ms - off.p50Ms).toFixed(2)} |`,
  `| P99 input latency (ms) | ${on.p99Ms.toFixed(2)} | ${off.p99Ms.toFixed(2)} | ${report.delta.p99DeltaMs.toFixed(2)} |`,
  `| LM calls | ${on.lmCalls} | ${off.lmCalls} | ${report.delta.lmCallDelta} |`,
  `| Tokens (in+out) | ${on.tokensIn + on.tokensOut} | ${off.tokensIn + off.tokensOut} | ${report.delta.tokenDelta} |`,
  `| Cost (milli-USD) | ${on.costMilli.toFixed(3)} | ${off.costMilli.toFixed(3)} | ${(on.costMilli - off.costMilli).toFixed(3)} |`,
  `| Tier-0 parse failures | ${on.parseFailures} | ${off.parseFailures} | ${on.parseFailures - off.parseFailures} |`,
  `| judgment.resolved events | ${on.judgmentsEmitted} | ${off.judgmentsEmitted} | +${report.delta.judgmentOverhead} |`,
  '',
].join('\n');
await writeFile(join(dir, 'system-one-onoff.md'), md);
console.log(md);
