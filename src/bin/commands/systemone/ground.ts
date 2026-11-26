/** Groundedness gate: .ground on|off|status|threshold <0-1> */

import { cmd } from '@senars/cli';
import { dispatchSub, onOff, ratioArg } from '../args';
import type { BotRuntime } from '../context';

export const groundCommand = cmd(
  'ground',
  'Groundedness gate: .ground on|off|status|threshold <0-1>',
  (rt: BotRuntime) => (args = '') => {
    const { ground } = rt;
    const usage = 'Usage: .ground on|off|status|threshold <0-1>';
    return dispatchSub(
      args,
      {
        ...onOff(
          () => ground.enabled,
          (v) => { ground.enabled = v; },
          (on) => `Groundedness gate: ${on ? 'on' : 'off'} threshold=${ground.threshold}`,
          'Groundedness gate'
        ),
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
  }
);