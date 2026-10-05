/** LM provider/model/routing/circuit-breaker commands (`.lm-*`, `.routing*`, `.circuit-*`). */

import {
  formatLMConfig,
  isGpuBackend,
  LM_PROVIDER_NAMES,
  resolveLMConfig,
  resolveLMSettings,
} from '@senars/nar/lm';
import { LM_TASKS, removeBy } from '@senars/util';
import { attempted, cmd } from '../../cli/commands.js';
import type { BotConfig } from '../../config/index.js';
import { tokenize } from './args.js';
import type { BotRuntime } from './context.js';

/** Supported GPU types, or `cpu`/`unknown` when the native probe is unavailable. */
export const gpuSummary = async (): Promise<string> => {
  try {
    const { getLlamaGpuTypes } = await import('node-llama-cpp');
    const types = (await getLlamaGpuTypes('supported')) as string[];
    const avail = types.filter(isGpuBackend);
    return avail.length ? avail.join(',') : 'cpu';
  } catch {
    return 'unknown';
  }
};

type LmRuleEntry = NonNullable<BotConfig['lmRules']>['rules'][number];

/** The mutable LM rule list from the effective config. */
const lmRulesOf = (rt: BotRuntime): LmRuleEntry[] => rt.appConfig.bot.lmRules.rules;

export const lmCommandsFor = (rt: BotRuntime) => {
  const { appConfig } = rt;
  return [
    cmd('lm-config', 'Show resolved LM config', async () => {
      const s = resolveLMSettings(appConfig.lm as never);
      const gpu =
        s.provider === 'llamacpp-embedded'
          ? ` gpu=${s.llamacppGpu ?? 'auto'} gpuDetail=${await gpuSummary()}`
          : '';
      return `${formatLMConfig(resolveLMConfig(appConfig.lm as never))}${gpu}\nfast=${s.fastModel ?? '—'} structured=${s.structuredModel ?? '—'} baseUrl=${s.baseUrl ?? '—'}`;
    }),
    cmd('lm-provider', 'Switch provider (takes effect on restart)', (args = '') => {
      const name = args.trim().toLowerCase();
      if (!name) return `provider=${resolveLMSettings(appConfig.lm as never).provider}`;
      if (!(LM_PROVIDER_NAMES as readonly string[]).includes(name)) {
        return `Unknown provider: ${name} (${LM_PROVIDER_NAMES.join('|')})`;
      }
      process.env.LM_PROVIDER = name;
      return `LM_PROVIDER=${name} (restart bot to apply)`;
    }),
    cmd('lm-model', 'Set model for tier: quality|fast|structured', (args = '') => {
      const [task, ...rest] = tokenize(args);
      const model = rest.join(' ');
      const envKeys = {
        quality: 'LM_MODEL',
        fast: 'LM_FAST_MODEL',
        structured: 'LM_STRUCTURED_MODEL',
      } as const;
      const envKey = task ? envKeys[task as keyof typeof envKeys] : undefined;
      if (!task || !model || !envKey) return 'Usage: .lm-model <quality|fast|structured> <model>';
      process.env[envKey] = model;
      return `${task} model=${model} (restart bot to apply)`;
    }),
    cmd(
      'lm-rules',
      'List LM rules from config',
      () =>
        (rt.appConfig.bot.lmRules?.rules ?? []).map((r) => r.id).join(', ') ||
        '(no lm rules configured)'
    ),
    cmd('lm-rule-enable', 'Enable an LM rule id', (args = '') => {
      const id = args.trim();
      if (!id) return 'Usage: .lm-rule-enable <id>';
      const rules = lmRulesOf(rt);
      if (!rules.some((r) => r.id === id)) rules.push({ id, enabled: true });
      return `Enabled ${id} (restart bot to register; persist with .config-save)`;
    }),
    cmd('lm-rule-disable', 'Disable an LM rule id', (args = '') => {
      const id = args.trim();
      if (!id) return 'Usage: .lm-rule-disable <id>';
      if (!removeBy(lmRulesOf(rt), (r) => r.id === id)) return `Not configured: ${id}`;
      return `Disabled ${id} (restart bot to deregister; persist with .config-save)`;
    }),
    cmd('routing', 'Show routing matrix', async () => {
      return attempted('routing unavailable', async () => {
        const { getModelChain } = await import('@senars/nar/lm/providers.js');
        const cfg = resolveLMConfig(appConfig.lm as never);
        return LM_TASKS.map((t) => `  ${t}: ${getModelChain(cfg.provider, t).join(' → ')}`).join(
          '\n'
        );
      });
    }),
    cmd('routing-set', 'Set routing candidates live: <model-id...>', async (args = '') => {
      const candidates = tokenize(args);
      if (!candidates.length) return 'Usage: .routing-set <model-id...>';
      return attempted('routing-set', async () => {
        const { getRouting, setRouting } = await import('@senars/nar/lm/providers.js');
        setRouting({ ...(getRouting() ?? {}), candidates });
        if (appConfig.routing) {
          (appConfig.routing as Record<string, unknown>).candidates = candidates;
        }
        return `candidates=${candidates.join(',')} (persist with .config-save)`;
      });
    }),
    cmd('routing-offline', 'Set offline failsafe ladder: <model-id...>', async (args = '') => {
      const offlineLadder = tokenize(args);
      if (!offlineLadder.length) return 'Usage: .routing-offline <model-id...>';
      return attempted('routing-offline', async () => {
        const { getRouting, setRouting } = await import('@senars/nar/lm/providers.js');
        setRouting({ ...(getRouting() ?? {}), offlineLadder });
        if (appConfig.routing) {
          (appConfig.routing as Record<string, unknown>).offlineLadder = offlineLadder;
        }
        return `offline ladder=${offlineLadder.join(' → ')} (persist with .config-save)`;
      });
    }),
    cmd('circuit-breakers', 'Show circuit breaker states', async () => {
      return attempted('circuit info unavailable', async () => {
        const { getCircuitBreaker, getEffectiveCircuitConfig } = await import(
          '@senars/nar/lm/providers.js'
        );
        const s = resolveLMSettings(appConfig.lm as never);
        return LM_PROVIDER_NAMES.map((p) => {
          try {
            const b = getCircuitBreaker(p as never);
            getEffectiveCircuitConfig(p as never, s as never);
            return `  ${p}: ${b.state} fails=${b.consecutiveFailures}`;
          } catch {
            return `  ${p}: n/a`;
          }
        }).join('\n');
      });
    }),
    cmd('circuit-reset', 'Reset circuit breaker(s): <provider>|all', async (args = '') => {
      const name = args.trim().toLowerCase();
      if (!name) return 'Usage: .circuit-reset <provider>|all';
      return attempted('circuit-reset', async () => {
        const { getCircuitBreaker, resetCircuitBreakers } = await import(
          '@senars/nar/lm/providers.js'
        );
        if (name === 'all') {
          resetCircuitBreakers();
          return 'All circuit breakers reset';
        }
        const b = getCircuitBreaker(name as never) as { reset?: () => void };
        if (typeof b.reset !== 'function') return `No resettable breaker: ${name}`;
        b.reset();
        return `Circuit breaker reset: ${name}`;
      });
    }),
  ];
};
