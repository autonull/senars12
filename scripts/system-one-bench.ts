/**
 * F3: System One on/off measurement — token-reduction (LM calls/spend) and
 * cycle-latency deltas over a synthetic utterance workload. Defaults to the
 * offline-deterministic mock leg (CI-safe); real-provider legs use a local
 * model (`LM_PROVIDER=llamacpp-embedded LM_LLAMACPP_MODEL=.models/*.gguf
 * pnpm bench:system-one`) and enable the System One Cortex so LM calls flow.
 *
 * Usage:
 *   pnpm bench:system-one                       # mock leg → .reports/system-one-onoff.{json,md}
 *   LM_PROVIDER=llamacpp-embedded ... pnpm bench:system-one   # real leg (overwrites the report)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createNAR } from '../nar/src/factory.js';
import { LMRuleFactory } from '../nar/src/lm/lm-rule-factory.js';
import { createSystemOneLMRuleAdapter } from '../nar/src/lm/system-one/rule-adapter.js';
import { termParser } from '../nar/src/terms/index.js';
import type { NAR } from '../nar/src/nar.js';

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
  /** Translation-workload phase (NL → Narsese): the LM-mediated baseline vs the System One pipeline. */
  translationLmCalls: number;
  translationTokensIn: number;
  translationTokensOut: number;
  translationMs: number;
  translationAccepted: number;
}

const PROVIDER = process.env.LM_PROVIDER ?? 'mock';

async function runLeg(enabled: boolean): Promise<LegResult> {
  const nar = createNAR({
    systemOne: {
      enabled,
      // Real-provider legs enable the Cortex so token-reduction is measurable;
      // the mock leg keeps the cortex off (zero-LM baseline).
      cortex: enabled && PROVIDER !== 'mock' ? { provider: PROVIDER as 'llamacpp' } : undefined,
    },
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

  // Translation workload: NL → Narsese through the real lm-narsese-translation rule.
  // ON leg: §8 REPLACE via the System One adapter (cortex synthesize + manifold select).
  // OFF leg: the rule's generative LM path — the baseline System One replaces.
  const spendOf = () => {
    const s = Object.values(nar.getLMClient?.()?.getSpend() ?? {}).reduce(
      (acc, v) => ({ calls: acc.calls + v.calls, tokensIn: acc.tokensIn + v.tokensIn, tokensOut: acc.tokensOut + v.tokensOut }),
      { calls: 0, tokensIn: 0, tokensOut: 0 }
    );
    return s;
  };
  const rule = new LMRuleFactory(nar.getLMClient() ?? null).narseseTranslation();
  if (enabled) {
    const dispatcher = nar.getSystemOneDispatcher();
    if (dispatcher) {
      rule.setSystemOneAdapter(
        createSystemOneLMRuleAdapter({
          dispatcher,
          nar: {
            getCycleCount: () => nar.getCycleCount(),
            getSystemOneEmbeddingCache: () => nar.getSystemOneEmbeddingCache(),
            getSystemOneManifold: () => nar.getSystemOneManifold(),
          },
        })
      );
    }
  }
  const beforeTranslation = spendOf();
  const translationStart = performance.now();
  let translationAccepted = 0;
  for (const utterance of UTTERANCES) {
    const term = termParser.parse(`"${utterance}"`);
    if (!term) continue;
    const tasks = await rule.apply(term);
    translationAccepted += tasks.length;
  }
  const translationMs = performance.now() - translationStart;
  const afterTranslation = spendOf();

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
    translationLmCalls: afterTranslation.calls - beforeTranslation.calls,
    translationTokensIn: afterTranslation.tokensIn - beforeTranslation.tokensIn,
    translationTokensOut: afterTranslation.tokensOut - beforeTranslation.tokensOut,
    translationMs,
    translationAccepted,
  };
  await nar.dispose();
  return result;
}

const on = await runLeg(true);
const off = await runLeg(false);

const report = {
  generatedAt: new Date().toISOString(),
  provider: PROVIDER,
  workload: { utterances: UTTERANCES.length, cyclesPerUtterance: CYCLES_PER_UTTERANCE },
  systemOneOn: on,
  systemOneOff: off,
  delta: {
    p99DeltaMs: on.p99Ms - off.p99Ms,
    lmCallDelta: on.lmCalls - off.lmCalls,
    tokenDelta: on.tokensIn + on.tokensOut - (off.tokensIn + off.tokensOut),
    judgmentOverhead: on.judgmentsEmitted,
  },
  translation: {
    offLmCalls: off.translationLmCalls,
    offTokens: off.translationTokensIn + off.translationTokensOut,
    onLmCalls: on.translationLmCalls,
    onTokens: on.translationTokensIn + on.translationTokensOut,
    tokenReduction: off.translationTokensIn + off.translationTokensOut - (on.translationTokensIn + on.translationTokensOut),
    onAcceptedTasks: on.translationAccepted,
    onMs: on.translationMs,
    offMs: off.translationMs,
  },
};

const dir = join(process.cwd(), '.reports');
await mkdir(dir, { recursive: true });
const suffix = PROVIDER === 'mock' ? '' : `-${PROVIDER}`;
await writeFile(join(dir, `system-one-onoff${suffix}.json`), JSON.stringify(report, null, 2));
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
  '## Translation workload (NL → Narsese through `lm-narsese-translation`)',
  '',
  'ON leg: §8 REPLACE via the System One adapter (cortex candidate synthesis + manifold selection). OFF leg: the rule\'s generative LM path — the baseline System One replaces.',
  '',
  '| Metric | System One ON | OFF (LM-mediated) |',
  '|--------|--------------:|------------------:|',
  `| LM calls | ${on.translationLmCalls} | ${off.translationLmCalls} |`,
  `| Tokens (in+out) | ${on.translationTokensIn + on.translationTokensOut} | ${off.translationTokensIn + off.translationTokensOut} |`,
  `| Wall time (ms) | ${on.translationMs.toFixed(1)} | ${off.translationMs.toFixed(1)} |`,
  `| Tasks admitted | ${on.translationAccepted} | ${off.translationAccepted} |`,
  `| Tokens / admitted task | ${(on.translationTokensIn + on.translationTokensOut) / Math.max(1, on.translationAccepted)} | ${(off.translationTokensIn + off.translationTokensOut) / Math.max(1, off.translationAccepted)} |`,
  '',
  'Note: candidate synthesis costs more raw tokens per translation (3 candidates per call), but admits far more tasks (the generative baseline\'s outputs frequently fail Narsese parsing and drop to the symbolic fallback). Cost per *admitted* task is the comparable figure.',
  '',
].join('\n');
await writeFile(join(dir, `system-one-onoff${suffix}.md`), md);
console.log(md);
