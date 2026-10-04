/**
 * System One status/diagnostic formatters — the `.status`, `.manifold`,
 * `.systemone` readout surfaces. Pure presentation over NAR; no command state.
 */

import type { NAR } from '@senars/nar';
import { readCalibrationLockOrNull } from '@senars/nar/lm/system-one';
import { flooredRatio, formatDuration, pct } from '@senars/util';
import { type AttachedGame, reflexesOf } from './conversation-game.js';

export function formatSystemOneStatus(nar: NAR, conversationGame: AttachedGame | null): string {
  const manifold = nar.getSystemOneManifold?.();
  const dispatcher = nar.getSystemOneDispatcher?.();
  const cortex = dispatcher ? (dispatcher as any).cortex : undefined;
  const groundednessGate = nar.getSystemOneGroundednessGate?.();
  const traceGrader = nar.getSystemOneTraceGrader?.();
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();

  const health = manifold?.health?.() ?? {
    ready: false,
    breakerOpen: false,
    rollingEce: 0,
    queueDepth: 0,
  };
  const cortexHealth = cortex?.health?.() ?? { provider: 'off', breakerOpen: true };
  const cacheMetrics = embeddingCache?.metrics?.() ?? {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
    size: 0,
  };

  const contrastive = nar.getSystemOneContrastive?.();
  const cStats = Object.entries(contrastive?.stats() ?? {});
  const totals = cStats.reduce(
    (a, [, s]) => ({ p: a.p + s.positives, n: a.n + s.negatives, c: a.c + (s.calibrated ? 1 : 0) }),
    { p: 0, n: 0, c: 0 }
  );
  const vetoes =
    reflexesOf(conversationGame).find((r) => r.id === 'lm-reflex')?.contrastiveVetoes ?? 0;

  return [
    'System One: enabled',
    `  Manifold: ${health.ready ? 'ready' : 'not ready'} (breaker: ${health.breakerOpen ? 'open' : 'closed'}, ECE: ${health.rollingEce.toFixed(4)}, queue: ${health.queueDepth})`,
    `  Dispatcher: ${dispatcher ? 'enabled' : 'disabled'}`,
    `  Cortex: ${cortexHealth.provider} (breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'})`,
    `  Groundedness Gate: ${groundednessGate ? 'enabled' : 'disabled'}`,
    `  Trace Grader: ${traceGrader ? 'enabled' : 'disabled'}`,
    `  Embedding Cache: ${cacheMetrics.size} entries, hit rate: ${pct(flooredRatio(cacheMetrics.hits, cacheMetrics.hits + cacheMetrics.misses))}`,
    `  Contrastive: ${totals.p}P/${totals.n}N across ${cStats.length} rubric(s), ${totals.c} calibrated (refresh: .calibrate refresh)`,
    `  Contrastive Vetoes (LMReflex): ${vetoes}`,
    ...(() => {
      const rep = nar.getSourceReputation?.();
      if (!rep || rep.size === 0) return [];
      return [
        '  Source Reputation:',
        ...[...rep.table()].map(
          ([key, e]) =>
            `    ${key}: ✓${e.confirmed}/✗${e.contradicted} ceiling ×${e.multiplier.toFixed(2)}`
        ),
      ];
    })(),
  ].join('\n');
}

export async function formatSystemOneHeads(nar: NAR): Promise<string> {
  const manifold = nar.getSystemOneManifold?.() as any;
  if (!manifold) return 'Manifold: not available';

  const calibrators = manifold.getCalibrators?.() ?? new Map();
  const abstainThresholds = manifold.getAbstainThresholds?.() ?? new Map();
  const heads =
    manifold.getHeads?.() ?? (manifold as { heads?: Map<string, unknown> }).heads ?? new Map();

  if (heads.size === 0 && calibrators.size === 0) return 'No heads registered';

  const lines = ['System One Heads:'];
  for (const [rubric, head] of heads) {
    const cal = calibrators.get(rubric);
    const abstain = abstainThresholds.get(rubric) ?? '—';
    const fitted = cal?.fitted ? 'yes' : 'no';
    const ece = cal?.getECE?.() ?? 0;
    const samples = cal?.getPoints?.()?.length ?? 0;
    lines.push(
      `  ${rubric}: fitted=${fitted} ECE=${ece.toFixed(4)} abstain=${abstain} samples=${samples}`
    );
  }
  // Phase 7: eval/ood metrics from the calibration lock (frozen-set fitted).
  const lock = await readCalibrationLockOrNull();
  for (const [label, metrics] of [
    ['eval', lock?.eval],
    ['ood', lock?.ood],
  ] as const)
    if (metrics)
      lines.push(
        `  ${label}: brier=${metrics.brier.toFixed(4)} ece=${metrics.ece.toFixed(4)} n=${metrics.count} digest=${metrics.datasetDigest.slice(0, 19)}`
      );
  return lines.join('\n');
}

export function formatSystemOneDispatcher(nar: NAR): string {
  const dispatcher = nar.getSystemOneDispatcher?.() as any;
  if (!dispatcher) return 'Dispatcher: not available';

  const tier1 = dispatcher.tier1;
  const dispatcherInfo = dispatcher.describe?.();
  const provisional = dispatcherInfo?.provisional ?? {};
  const cortexHealth = dispatcherInfo
    ? { provider: dispatcherInfo.cortexProvider, breakerOpen: dispatcherInfo.cortexBreakerOpen }
    : { provider: 'off', breakerOpen: true };

  const lines = [
    'System One Dispatcher:',
    `  Tier 0 (Deterministic): always active`,
    `  Tier 1 (Manifold): ${tier1 ? 'enabled' : 'disabled'}`,
    `  Tier 2 (Cortex): ${cortexHealth.provider} (breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'})`,
    `  Tier 3 (Symbolic): always active`,
    `  Provisional Cache: cInitial=${provisional.cInitial ?? '—'} decayRate=${provisional.decayRate ?? '—'} maxTtlMs=${provisional.maxTtlMs ?? '—'}`,
  ];
  // Phase 5: per-level latency accounting (L0 deterministic / L1 manifold).
  const latency = (dispatcher.latencyStats?.() ?? {}) as Record<
    string,
    { calls: number; judgments: number; meanMs: number }
  >;
  for (const [level, s] of Object.entries(latency)) {
    lines.push(
      `  ${level}: calls=${s.calls} judgments=${s.judgments} mean=${formatDuration(s.meanMs)}`
    );
  }
  return lines.join('\n');
}

export function formatSystemOneCortex(nar: NAR): string {
  const dispatcher = nar.getSystemOneDispatcher?.() as any;
  if (!dispatcher) return 'Dispatcher: not available';

  const cortex = dispatcher.cortex;
  const cortexHealth = cortex?.health?.() ?? { provider: 'off', breakerOpen: true };
  const cortexConfig = cortex?.describe?.() as
    | { grammar: string; temperature: number; model?: string }
    | undefined;

  const lines = [
    'System One Cortex:',
    `  Provider: ${cortexHealth.provider}`,
    `  Breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'}`,
    `  Grammar: ${cortexConfig?.grammar ?? 'narsese-term'}`,
    `  Temperature: ${cortexConfig?.temperature ?? 0}`,
    `  Model Binding: ${cortexConfig?.model ?? '—'}`,
  ];
  return lines.join('\n');
}

export function formatSystemOneReflexes(nar: NAR): string {
  const attachedGames = (
    nar as unknown as { games?: { attachedGames?: Map<string, AttachedGame> } }
  ).games?.attachedGames;
  if (!attachedGames || attachedGames.size === 0) return 'No games attached';

  const lines = ['System One Reflexes (per focus):'];
  for (const [gameId, entry] of attachedGames) {
    const reflexes = reflexesOf(entry);
    lines.push(`  ${gameId}:`);
    for (const reflex of reflexes) {
      lines.push(
        `    ${reflex.id}: arms=${reflex.numArms ?? '—'} epsilon=${reflex.epsilon ?? '—'}`
      );
    }
    if (reflexes.length === 0) lines.push('    (no reflexes)');
  }
  return lines.join('\n');
}
