/** Provisional cache: .provisional status|flush */

import { cmd } from '@senars/cli';
import { dispatchSub } from '../args';
import type { BotRuntime } from '../context';

export const provisionalCommand = cmd(
  'provisional',
  'Provisional cache: .provisional status|flush',
  (rt: BotRuntime) => (args = '') =>
    dispatchSub(
      args,
      {
        status: () => {
          const prov = (
            rt.wired.nar.getSystemOneDispatcher?.() as
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
);