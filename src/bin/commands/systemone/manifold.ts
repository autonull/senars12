/** Manifold health */

import { attempted, cmd } from '@senars/cli';
import type { BotRuntime } from '../context';

export const manifoldCommand = cmd(
  'manifold',
  'Manifold health',
  (rt: BotRuntime) => async () => {
    const m = rt.wired.nar.getSystemOneManifold?.() as { health?: () => unknown } | undefined;
    if (!m) return 'Manifold: not constructed (System One disabled)';
    return attempted('manifold health', () => JSON.stringify(m.health?.() ?? {}, null, 2));
  }
);