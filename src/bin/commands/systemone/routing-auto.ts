/** Dispatcher auto-routing: .routing-auto on|off|status|policy <conservative|balanced|aggressive> */

import { cmd, dispatchSub, onOff } from '../cli';
import type { BotRuntime } from '../context';

const POLICIES = ['conservative', 'balanced', 'aggressive'] as const;

export const routingAutoCommand = cmd(
  'routing-auto',
  'Dispatcher auto-routing: .routing-auto on|off|status|policy <conservative|balanced|aggressive>',
  (rt: BotRuntime) => (args = '') => {
    const { routing } = rt;
    const usage = 'Usage: .routing-auto on|off|status|policy <conservative|balanced|aggressive>';
    return dispatchSub(
      args,
      {
        ...onOff(
          () => routing.auto,
          (v) => { routing.auto = v; },
          (on) => `Auto-routing: ${on ? 'on' : 'off'} policy=${routing.policy}`,
          'Auto-routing'
        ),
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
);