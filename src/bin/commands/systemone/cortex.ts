/** Cortex control: .cortex on|off|status|model <id>|grammar <narsese|json> */

import { cmd, dispatchSub, flagsOf } from '../cli';
import type { BotRuntime } from '../context';

export const cortexCommand = cmd(
  'cortex',
  'Cortex control: .cortex on|off|status|model <id>|grammar <narsese|json>',
  (rt: BotRuntime) => async (args = '') => {
    const dispatcher = rt.wired.nar.getSystemOneDispatcher?.() as { cortex?: unknown } | undefined;
    if (!dispatcher) return 'System One dispatcher not available';
    const { StubCortex } = await import('@senars/lm/system-one');
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
);