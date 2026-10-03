/** System One Judgment Manifold commands (`.judge`, `.cortex`, `.reflex`, `.ground`, `.s1-config`, …). */

import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createSystemOneBudget } from '@senars/nar/lm/system-one';
import { errMsg, finiteOr, incrementCount } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { type ReflexView, reflexesOf } from '../../cli/conversation-game.js';
import {
  formatSystemOneCortex,
  formatSystemOneDispatcher,
  formatSystemOneHeads,
  formatSystemOneReflexes,
  formatSystemOneStatus,
} from '../../cli/systemone-format.js';
import {
  coerce,
  dispatchSub,
  flagsOf,
  positiveArg,
  ratioArg,
  type SubHandler,
  setPath,
} from './args.js';
import type { BotRuntime } from './context.js';

const EVAL_SET_PATH = '.cache/systemone/eval-set.json';
const DEFAULT_DATASET_PATH = '.cache/systemone/dataset.jsonl';

const datasetPathOf = (rt: BotRuntime): string =>
  rt.appConfig.systemOne?.distillation?.datasetPath ?? DEFAULT_DATASET_PATH;

const systemOneOf = (rt: BotRuntime) =>
  rt.wired.nar as unknown as {
    systemOne?: { dataset?: { size: number; all(): ReadonlyArray<{ source: string }> } };
  };

/** The self-meta-game surface the `.meta` and `.drive` commands read. */
interface SelfMetaView {
  readonly id: string;
  readonly cycle?: number;
  readonly observesFocuses?: string[];
  readonly scheduler?: DriveScheduler;
  getGovernanceQueues?(): { validation: number; approval: number };
  getAllKnobs?(): Map<string, unknown>;
  applyProposal?(p: { kind: string; riskTier: string; payload: unknown; correlationId?: string }): {
    applied: boolean;
    reason: string;
  };
}

/** Drive stimulation is routed through the reward gate, never applied directly. */
interface DriveScheduler {
  readonly rewardGate: {
    process(event: Record<string, unknown>): { accepted: boolean; rejectionReason?: string };
  };
}

/** One toggle verb over one bound reflex, with per-verb missing-attachment messages. */
const toggleReflex =
  (
    reflexes: readonly ReflexView[],
    disable: (id: string) => void,
    spec: { id: string; label: string; verb: string; onMissing: string; offMissing: string }
  ): SubHandler =>
  ([state]) => {
    const attached = reflexes.some((r) => r.id === spec.id);
    if (state === 'on') return attached ? `${spec.label} already active` : spec.onMissing;
    if (state === 'off') {
      if (!attached) return spec.offMissing;
      disable(spec.id);
      return `${spec.label} disabled`;
    }
    return `Usage: .reflex ${spec.verb} on|off`;
  };

export const systemOneCommandsFor = (rt: BotRuntime) => {
  const { nar, episodicMemory } = rt.wired;
  return [
    cmd(
      'systemone',
      'System One status / subcommands: heads|dispatcher|cortex|reflexes|eval-set',
      (args = '') => {
        if (!nar.isSystemOneEnabled?.()) {
          return 'System One: disabled (enable via config systemOne.enabled + restart)';
        }
        return dispatchSub(
          args,
          {
            status: () => formatSystemOneStatus(nar, rt.conversationGame),
            heads: () => formatSystemOneHeads(nar),
            dispatcher: () => formatSystemOneDispatcher(nar),
            cortex: () => formatSystemOneCortex(nar),
            reflexes: () => formatSystemOneReflexes(nar),
            'eval-set': async ([action]) => {
              const { createFrozenEvalSet, evalMetrics, headMetrics, loadEvalSet, writeEvalSet } =
                await import('@senars/nar/lm/system-one/eval-set.js');
              const { JudgmentDataset } = await import('@senars/nar/lm/system-one/distill.js');
              if (action === 'create' || action === 'regenerate') {
                const set = createFrozenEvalSet(await JudgmentDataset.load(datasetPathOf(rt)));
                await writeEvalSet(set, EVAL_SET_PATH);
                const m = evalMetrics(set.rows);
                return `Eval set frozen: ${set.rows.length} rows (conversation-captured excluded) → ${EVAL_SET_PATH}\ndigest=${set.digest}\nbrier=${m.brier.toFixed(4)} ece=${m.ece.toFixed(4)}`;
              }
              if (action === 'show') {
                try {
                  const set = await loadEvalSet(EVAL_SET_PATH);
                  const lines = [
                    `Eval set: ${set.rows.length} rows, digest=${set.digest}`,
                    `frozen at ${new Date(set.createdAt).toISOString()}`,
                    ...Object.entries(headMetrics(set.rows)).map(
                      ([head, m]) =>
                        `  ${head}: n=${m.count} brier=${m.brier.toFixed(4)} ece=${m.ece.toFixed(4)}`
                    ),
                  ];
                  return lines.join('\n');
                } catch (e) {
                  return `eval-set load failed (run .systemone eval-set create): ${errMsg(e)}`;
                }
              }
              return 'Usage: .systemone eval-set create|show|regenerate (regenerate is explicit + logged)';
            },
          },
          {
            defaults: ['status'],
            usage: 'Usage: .systemone heads|dispatcher|cortex|reflexes|eval-set',
          }
        );
      }
    ),
    cmd(
      'judge',
      'Run manifold heads on a proposition: .judge <proposition> [--head <rubric>] [--explain]',
      async (args = '') => {
        const decider = nar.getSystemOneDecider?.();
        if (!decider) return 'System One decider not available';
        const { positional, str, has } = flagsOf(args);
        const proposition = positional.join(' ');
        if (!proposition) return 'Usage: .judge <proposition> [--head <rubric>] [--explain]';
        const headRubric = str('--head', '');
        const evaluate = (rubric: string) => ({
          kind: 'evaluate' as const,
          instruction: `Evaluate ${rubric}`,
          rubric: rubric as never,
          axis: 'epistemic' as const,
        });
        const queries = headRubric
          ? [evaluate(headRubric)]
          : ['entailment', 'groundedness', 'plausibility', 'assertion'].map(evaluate);
        try {
          const result = await decider.decide({
            context: proposition,
            queries,
            budget: createSystemOneBudget(),
          });
          const lines = result.verdicts.map((v) => {
            const r = v.proposition;
            if (!r || r.kind === 'classify') {
              const top = r && r.kind === 'classify' ? r.top : undefined;
              return `${v.query.rubric}: top=${top?.option ?? '—'} p=${top?.p.toFixed(3) ?? '—'} abstained=${v.abstained} band=${v.band}${v.skipped ? ' skipped' : ''}`;
            }
            return `${v.query.rubric}: score=${r.score.toFixed(3)} abstained=${r.abstained} latency=${r.latencyMs}ms band=${v.band}${v.skipped ? ' skipped' : ''}`;
          });
          lines.push(
            `band=${result.band} composite=${result.composite?.score.toFixed(3) ?? '—'} contrastive=${result.contrastive.score?.toFixed(3) ?? '—'}`
          );
          if (has('--explain')) {
            const p = result.provenance;
            lines.push(
              `provenance: model=${p.modelDigest ?? '—'} calibration=${p.calibrationDigest ?? '—'} input=${p.inputDigest.slice(0, 12)} fitted=${p.fitted} abstained=${p.abstained} at=${new Date(p.timestamp).toISOString()}`
            );
          }
          return lines.join('\n');
        } catch (e) {
          return `judge failed: ${errMsg(e)}`;
        }
      }
    ),
    cmd(
      'decide',
      'Unified decision (heads + contrastive + router): .decide <input> [--rubrics a,b,c]',
      async (args = '') => {
        const decider = nar.getSystemOneDecider?.();
        if (!decider) return 'System One decider not available';
        const { positional, list } = flagsOf(args);
        const input = positional.join(' ');
        if (!input) return 'Usage: .decide <input> [--rubrics a,b,c]';
        const rubrics = flagsOf(args).has('--rubrics')
          ? list('--rubrics', [])
          : ['relevance', 'groundedness', 'injection', 'ambiguity', 'plausibility'];
        try {
          const result = await decider.decide({
            context: input,
            queries: rubrics.map((rubric) => ({
              kind: 'evaluate' as const,
              instruction: `Evaluate ${rubric}`,
              rubric: rubric as never,
              axis: 'epistemic' as const,
            })),
            budget: createSystemOneBudget(),
          });
          const lines = result.verdicts.map(
            (v) =>
              `  ${v.query.rubric}: ${(v.proposition as { score?: number })?.score?.toFixed(3) ?? '—'} band=${v.band} abstained=${v.abstained}${v.skipped ? ' skipped' : ''}`
          );
          lines.push(
            `  band=${result.band} composite=${result.composite?.score.toFixed(3) ?? '—'} contrastive=${result.contrastive.score?.toFixed(3) ?? '—'} penalty=${result.contrastive.penalty?.toFixed(3) ?? '—'}`
          );
          const p = result.provenance;
          lines.push(
            `  provenance: model=${p.modelDigest ?? '—'} calibration=${p.calibrationDigest ?? '—'} input=${p.inputDigest.slice(0, 12)} at=${new Date(p.timestamp).toISOString()}`
          );
          return `Decision for: "${input}"\n${lines.join('\n')}`;
        } catch (e) {
          return `decide failed: ${errMsg(e)}`;
        }
      }
    ),
    cmd(
      'route',
      'Show dispatcher routing decision for a task: .route <task> [--verbose]',
      async (args = '') => {
        const dispatcher = nar.getSystemOneDispatcher?.();
        const embeddingCache = nar.getSystemOneEmbeddingCache?.();
        if (!dispatcher || !embeddingCache) return 'System One dispatcher not available';
        const { positional, has } = flagsOf(args);
        const verbose = has('--verbose');
        const task = positional.join(' ');
        if (!task) return 'Usage: .route <task> [--verbose]';
        const budget = createSystemOneBudget();
        const queries = [
          {
            kind: 'classify' as const,
            instruction: 'Classify task type',
            space: ['question', 'belief', 'goal', 'tool'],
            axis: 'epistemic' as const,
            rubric: 'task_type' as never,
          },
          {
            kind: 'evaluate' as const,
            instruction: 'Evaluate injection risk',
            rubric: 'injection' as never,
            axis: 'epistemic' as const,
          },
          {
            kind: 'evaluate' as const,
            instruction: 'Evaluate ambiguity',
            rubric: 'ambiguity' as never,
            axis: 'epistemic' as const,
          },
        ];
        try {
          const results = await dispatcher.judge(
            (await embeddingCache.write(task)) as never,
            queries,
            budget
          );
          const lines = ['Routing decision for:', `  "${task}"`, ''];
          for (const [i, r] of results.entries()) {
            const q = queries[i];
            if (!q) continue;
            if (r.kind === 'classify') {
              const cp = r as {
                kind: 'classify';
                top: { option: string; p: number };
                entropy: number;
                tier: number;
              };
              lines.push(
                `  ${q.rubric}: ${cp.top.option} (p=${cp.top.p.toFixed(3)})${verbose ? ` entropy=${cp.entropy.toFixed(3)} tier=${cp.tier}` : ''}`
              );
            } else {
              const ep = r as {
                kind: 'evaluate';
                score: number;
                abstained: boolean;
                tier: number;
                latencyMs: number;
              };
              lines.push(
                `  ${q.rubric}: score=${ep.score.toFixed(3)} abstained=${ep.abstained}${verbose ? ` tier=${ep.tier} latency=${ep.latencyMs}ms` : ''}`
              );
            }
          }
          lines.push(
            '',
            `Path: ${results.some((r) => r.tier === 1) ? 'tier1 (manifold)' : 'tier0 (deterministic)'}`
          );
          return lines.join('\n');
        } catch (e) {
          return `route failed: ${errMsg(e)}`;
        }
      }
    ),
    cmd(
      'cortex',
      'Cortex control: .cortex on|off|status|model <id>|grammar <narsese|json>',
      async (args = '') => {
        const dispatcher = nar.getSystemOneDispatcher?.() as { cortex?: unknown } | undefined;
        if (!dispatcher) return 'System One dispatcher not available';
        const { StubCortex } = await import('@senars/nar/lm/system-one/dispatcher.js');
        const cortex = dispatcher.cortex as {
          health?: () => { provider?: string; breakerOpen?: boolean };
          describe?: () => { grammar?: string; temperature?: number; model?: string };
          setRuntimeTuning?: (t: Record<string, unknown>) => void;
        };
        if (!cortex || cortex instanceof StubCortex) {
          return 'Cortex not available (System One cortex provider must be configured)';
        }
        const usage = 'Usage: .cortex on|off|status|model <id>|grammar <narsese|json>';
        return dispatchSub(
          args,
          {
            status: () => {
              const health = cortex.health?.();
              const cfg = cortex.describe?.();
              return `Cortex: ${health?.provider ?? 'unknown'} (breaker: ${health?.breakerOpen ? 'open' : 'closed'}) grammar=${cfg?.grammar ?? 'narsese-term'} temp=${cfg?.temperature ?? 0} model=${cfg?.model ?? '—'}`;
            },
            // Toggling the provider needs a config change; report the seam instead of faking it.
            on: () => 'Cortex enable requires config change (systemOne.cortex.provider) + restart',
            off: () =>
              'Cortex disable requires config change (systemOne.cortex.provider=off) + restart',
            model: ([id]) => {
              if (!id) return 'Usage: .cortex model <id>';
              cortex.setRuntimeTuning?.({ model: id });
              return `Cortex model set to ${id} (runtime only; persist via .s1-config)`;
            },
            grammar: ([grammar]) => {
              if (!grammar) return 'Usage: .cortex grammar <narsese-term|json>';
              if (grammar !== 'narsese-term' && grammar !== 'json') {
                return 'Grammar must be narsese-term or json';
              }
              cortex.setRuntimeTuning?.({ grammar });
              return `Cortex grammar set to ${grammar} (runtime only; persist via .s1-config)`;
            },
          },
          { defaults: ['status'], usage }
        );
      }
    ),
    cmd('manifold', 'Manifold health', async () => {
      const m = nar.getSystemOneManifold?.() as { health?: () => unknown } | undefined;
      if (!m) return 'Manifold: not constructed (System One disabled)';
      try {
        return JSON.stringify(m.health?.() ?? {}, null, 2);
      } catch (e) {
        return `manifold error: ${errMsg(e)}`;
      }
    }),
    cmd('calibrate', 'Calibration lock status: .calibrate [refresh|refit]', async (args = '') => {
      const {
        CALIBRATION_LOCK_PATH,
        readCalibrationLockOrNull,
        writeCalibrationLock,
        fitCalibrationLock,
      } = await import('@senars/nar/lm/system-one/calibration-fit.js');
      const verb = args.trim().toLowerCase();
      if (verb === 'refresh') {
        if (!nar.isSystemOneEnabled?.()) return 'System One: disabled';
        await nar.refreshSystemOneContrastive(episodicMemory);
        const stats = nar.getSystemOneContrastive?.()?.stats() ?? {};
        const totals = Object.values(stats).reduce(
          (a, s) => ({ p: a.p + s.positives, n: a.n + s.negatives }),
          { p: 0, n: 0 }
        );
        return `Contrastive exemplars refreshed: ${totals.p}P/${totals.n}N across ${Object.keys(stats).length} rubric(s)`;
      }
      if (verb === 'refit') {
        if (!nar.isSystemOneEnabled?.()) return 'System One: disabled';
        try {
          const { JudgmentDataset } = await import('@senars/nar/lm/system-one/distill.js');
          const { digestRows, loadEvalSet, splitOod } = await import(
            '@senars/nar/lm/system-one/eval-set.js'
          );
          const dataset = await JudgmentDataset.load(datasetPathOf(rt));
          let options: Record<string, unknown> = {};
          try {
            const frozen = await loadEvalSet(EVAL_SET_PATH);
            const { inDomain, ood } = splitOod(frozen.rows);
            options = {
              frozenSet: {
                digest: inDomain.length > 0 ? digestRows(inDomain) : frozen.digest,
                rows: inDomain,
              },
              ...(ood.length > 0 ? { oodSet: { digest: digestRows(ood), rows: ood } } : {}),
            };
          } catch {
            // No frozen set — per-run holdout only.
          }
          const { lock, perHead, improved } = fitCalibrationLock(dataset, options as never);
          await writeCalibrationLock(lock, CALIBRATION_LOCK_PATH);
          return `Calibration lock refit: ${perHead.size} head(s), holdout ECE improved=${improved}, frozen-set metrics=${lock.eval ? 'embedded' : 'absent (run .systemone eval-set create)'}\nRestart required to apply the lock to the manifold.`;
        } catch (e) {
          return `refit failed: ${errMsg(e)}`;
        }
      }
      if (!existsSync(CALIBRATION_LOCK_PATH)) {
        return 'No calibration lock (heads unfitted — pass-through mode)';
      }
      const lock = await readCalibrationLockOrNull();
      if (!lock) return `lock unreadable: ${CALIBRATION_LOCK_PATH}`;
      const heads = lock.heads
        .map((h) => `  ${h.headId}: abstain=${h.fitted ? h.abstainThreshold.toFixed(4) : '—'}`)
        .join('\n');
      return `lock ${statSync(CALIBRATION_LOCK_PATH).size}B\n${heads || '  (no per-head data)'}`;
    }),
    cmd('distill', 'Distillation dataset status', () => {
      const p = datasetPathOf(rt);
      const st = existsSync(p) ? `${statSync(p).size}B` : 'absent';
      return `dataset ${p}: ${st}\nRun full teacher→student loop: pnpm run demo:arcade -- --distill`;
    }),
    cmd('ground', 'Groundedness gate: .ground on|off|status|threshold <0-1>', (args = '') => {
      const { ground } = rt;
      const usage = 'Usage: .ground on|off|status|threshold <0-1>';
      return dispatchSub(
        args,
        {
          status: () =>
            `Groundedness gate: ${ground.enabled ? 'on' : 'off'} threshold=${ground.threshold}`,
          on: () => {
            ground.enabled = true;
            return 'Groundedness gate enabled';
          },
          off: () => {
            ground.enabled = false;
            return 'Groundedness gate disabled';
          },
          threshold: ([raw]) => {
            if (!raw) return 'Usage: .ground threshold <0-1>';
            const parsed = ratioArg(raw, 'Threshold');
            if ('error' in parsed) return parsed.error;
            ground.threshold = parsed.value;
            return `Groundedness threshold set to ${parsed.value}`;
          },
        },
        { defaults: ['status'], usage }
      );
    }),
    cmd('trace', 'Trace grader: .trace on|off|status|sample <0-1>|dataset', (args = '') => {
      const { trace } = rt;
      const usage = 'Usage: .trace on|off|status|sample <0-1>|dataset';
      return dispatchSub(
        args,
        {
          status: () =>
            `Trace grader: ${trace.enabled ? 'on' : 'off'} sampleRate=${trace.sampleRate} grader=${trace.grader ? 'available' : 'unavailable'}`,
          on: () => {
            trace.enabled = true;
            return 'Trace grader enabled';
          },
          off: () => {
            trace.enabled = false;
            return 'Trace grader disabled';
          },
          sample: ([raw]) => {
            if (!raw) return 'Usage: .trace sample <0-1>';
            const parsed = ratioArg(raw, 'Sample rate');
            if ('error' in parsed) return parsed.error;
            trace.sampleRate = parsed.value;
            return `Trace sample rate set to ${parsed.value}`;
          },
          dataset: () => {
            const dataset = systemOneOf(rt).systemOne?.dataset;
            if (!dataset) return 'Dataset not available (distillation not configured)';
            const bySource = new Map<string, number>();
            for (const row of dataset.all()) incrementCount(bySource, row.source, 1);
            return `Dataset: ${dataset.size} labels\n${[...bySource].map(([s, n]) => `  ${s}: ${n}`).join('\n')}`;
          },
        },
        { defaults: ['status'], usage }
      );
    }),
    cmd(
      'reflex',
      'Reflex control: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>',
      (args = '') => {
        const game = rt.conversationGame;
        if (!game) return 'ConversationGame not attached (System One must be enabled)';
        const focus = game.focus.getFocus();
        const reflexes = reflexesOf(game);
        const usage = 'Usage: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>';
        const toggle = (spec: Parameters<typeof toggleReflex>[2]) =>
          toggleReflex(reflexes, focus.disableReflex.bind(focus), spec);
        return dispatchSub(
          args,
          {
            list: () =>
              reflexes.length === 0
                ? 'No reflexes attached'
                : reflexes
                    .map(
                      (r) =>
                        `  ${r.id}: arms=${r.numArms ?? '—'} epsilon=${r.epsilon ?? '—'} budget=${r.budget?.maxCycles ?? '—'}`
                    )
                    .join('\n'),
            manifold: toggle({
              id: 'manifold-reflex',
              label: 'ManifoldReflex',
              verb: 'manifold',
              onMissing: 'ManifoldReflex not attached',
              offMissing: 'ManifoldReflex not attached',
            }),
            lm: toggle({
              id: 'lm-reflex',
              label: 'LMReflex',
              verb: 'lm',
              onMissing: 'LMReflex not attached (enable with lmReflex option)',
              offMissing: 'LMReflex not attached',
            }),
            budget: ([raw]) => {
              if (!raw) return 'Usage: .reflex budget <cycles>';
              const parsed = positiveArg(raw, 'Budget');
              if ('error' in parsed) return parsed.error;
              for (const r of reflexes) {
                if (r.budget) r.budget.maxCycles = parsed.value;
              }
              return `Reflex budget set to ${parsed.value} cycles`;
            },
            arms: ([raw]) => {
              if (!raw) return 'Usage: .reflex arms <n>';
              const parsed = positiveArg(raw, 'Arms');
              if ('error' in parsed) return parsed.error;
              for (const r of reflexes) {
                if ('numArms' in r) (r as { numArms?: number }).numArms = parsed.value;
              }
              return `Reflex arms set to ${parsed.value}`;
            },
          },
          { defaults: ['list'], usage }
        );
      }
    ),
    cmd(
      'routing-auto',
      'Dispatcher auto-routing: .routing-auto on|off|status|policy <conservative|balanced|aggressive>',
      (args = '') => {
        const { routing } = rt;
        const usage =
          'Usage: .routing-auto on|off|status|policy <conservative|balanced|aggressive>';
        const POLICIES = ['conservative', 'balanced', 'aggressive'] as const;
        return dispatchSub(
          args,
          {
            status: () => `Auto-routing: ${routing.auto ? 'on' : 'off'} policy=${routing.policy}`,
            on: () => {
              routing.auto = true;
              return 'Auto-routing enabled';
            },
            off: () => {
              routing.auto = false;
              return 'Auto-routing disabled';
            },
            policy: ([raw]) => {
              if (!raw) return 'Usage: .routing-auto policy <conservative|balanced|aggressive>';
              if (!(POLICIES as readonly string[]).includes(raw)) {
                return 'Policy must be conservative|balanced|aggressive';
              }
              routing.policy = raw as (typeof POLICIES)[number];
              return `Routing policy set to ${raw}`;
            },
          },
          { defaults: ['status'], usage }
        );
      }
    ),
    cmd('provisional', 'Provisional cache: .provisional status|flush', (args = '') =>
      dispatchSub(
        args,
        {
          status: () => {
            const prov = (
              nar.getSystemOneDispatcher?.() as
                | { describe?: () => { provisional?: Record<string, unknown> } }
                | undefined
            )?.describe?.().provisional;
            return `Provisional cache: ${rt.provisional.enabled ? 'enabled' : 'disabled'} cInitial=${prov?.cInitial ?? '—'} decayRate=${prov?.decayRate ?? '—'} maxTtlMs=${prov?.maxTtlMs ?? '—'}`;
          },
          // The dispatcher's provisional cache is internal; flushing needs a dispatcher API.
          flush: () => 'Provisional cache flush not yet implemented (requires dispatcher API)',
        },
        {
          defaults: ['status'],
          usage: 'Usage: .provisional status|flush',
        }
      )
    ),
    cmd(
      'meta',
      'Self-meta-game: .meta status|drives|proposals|propose <type> [args...]',
      (args = '') => {
        const metaGame = nar.getSelfMetaGame?.() as unknown as SelfMetaView | undefined;
        if (!metaGame)
          return 'Self-meta-game not available (requires System One with self enabled)';
        const usage = 'Usage: .meta status|drives|proposals|propose <type> [args...]';
        return dispatchSub(
          args,
          {
            status: () => {
              const queues = metaGame.getGovernanceQueues?.() ?? { validation: 0, approval: 0 };
              const observes = metaGame.observesFocuses ?? [];
              const knobs = metaGame.getAllKnobs?.() ?? new Map<string, unknown>();
              return [
                'Self-Meta-Game:',
                `  ID: ${metaGame.id}`,
                `  Cycle: ${metaGame.cycle ?? 0}`,
                `  Observed focuses: ${observes.length ? observes.join(', ') : '(none)'}`,
                `  Governance queues: validation=${queues.validation} approval=${queues.approval}`,
                `  Knobs: ${knobs.size ? [...knobs.entries()].map(([k, v]) => `${k}=${v}`).join(', ') : '(none)'}`,
              ].join('\n');
            },
            drives: () =>
              metaGame.scheduler
                ? 'Drives: test_failed, contradiction_detected, low_coverage (use .drive stimulate <name>)'
                : 'No scheduler attached (drives require scheduler)',
            proposals: () => {
              // The proposal router is private; queue depths already surface the depth.
              const queues = metaGame.getGovernanceQueues?.() ?? { validation: 0, approval: 0 };
              const total = queues.validation + queues.approval;
              return total === 0
                ? 'No pending proposals'
                : `${total} pending proposal(s): validation=${queues.validation} approval=${queues.approval}`;
            },
            propose: ([type, ...rest]) => {
              if (!type) return 'Usage: .meta propose <type> [args...]';
              const result = metaGame.applyProposal?.({
                kind: type,
                riskTier: 'low',
                payload: { args: rest },
                correlationId: `manual-${Date.now()}`,
              }) ?? { applied: false, reason: 'applyProposal not available' };
              return result.applied
                ? `Proposal applied: ${result.reason}`
                : `Proposal rejected: ${result.reason}`;
            },
          },
          { defaults: ['status'], usage }
        );
      }
    ),
    cmd('drive', 'Drive stimulation: .drive stimulate <name> [intensity]', (args = '') => {
      const usage = 'Usage: .drive stimulate <name> [intensity]';
      return dispatchSub(
        args,
        { stimulate: ([name, raw]) => stimulateDrive(rt, name, raw) },
        { usage }
      );
    }),
    cmd(
      's1-config',
      'System One config: .s1-config show|set <path> <value>|save|reload',
      async (args = '') => {
        const usage = 'Usage: .s1-config show|set <path> <value>|save|reload';
        return dispatchSub(
          args,
          {
            show: () => JSON.stringify(rt.appConfig.systemOne ?? {}, null, 2),
            set: ([path, ...rest]) => {
              if (!path || !rest.length) return 'Usage: .s1-config set <path> <value>';
              const value = coerce(rest.join(' '));
              return setPath(
                rt.appConfig as unknown as Record<string, unknown>,
                `systemOne.${path}`,
                value
              )
                ? `Set systemOne.${path} (persist with .s1-config save)`
                : `Unknown path: systemOne.${path}`;
            },
            save: async ([path]) => {
              const target = path || process.env.SENARS_CONFIG || 'senars.config.json';
              await writeFile(target, JSON.stringify(rt.appConfig, null, 2));
              return `Saved to ${target}`;
            },
            reload: async () => {
              const { loadConfig } = await import('../../config/index.js');
              rt.appConfig = await loadConfig();
              return 'Config reloaded (LM/routing changes need restart)';
            },
          },
          { defaults: ['show'], usage }
        );
      }
    ),
  ];
};

/** Route a drive-stimulation request through the reward gate (never applied directly). */
const stimulateDrive = (
  rt: BotRuntime,
  name: string | undefined,
  raw: string | undefined
): string => {
  if (!name) return 'Usage: .drive stimulate <name> [intensity]';
  const metaGame = rt.wired.nar.getSelfMetaGame?.() as unknown as SelfMetaView | undefined;
  if (!metaGame) return 'Self-meta-game not available';
  const { scheduler } = metaGame;
  if (!scheduler) return 'No scheduler attached (drives require scheduler)';
  const intensity = finiteOr(raw, 1.0);
  const check = scheduler.rewardGate.process({
    eventId: `drive-${Date.now()}`,
    rewardSignal: intensity,
    rewardType: 'intrinsic',
    targetType: 'policy-weights',
    targetId: 'drive',
    domain: 'self-scheduler',
  });
  return check.accepted
    ? `Drive ${name} stimulated (intensity=${intensity})`
    : `Drive ${name} rejected: ${check.rejectionReason}`;
};
