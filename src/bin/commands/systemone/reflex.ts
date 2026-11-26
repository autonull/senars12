/** Reflex control: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n> */

import { cmd } from '@senars/cli';
import { dispatchSub, positiveArg } from '../args';
import { reflexesOf, type ReflexView } from '@senars/cli/conversation-game';
import { makeToggleReflex, type ToggleReflexSpec } from './types';
import type { BotRuntime } from '../context';

export const reflexCommand = cmd(
  'reflex',
  'Reflex control: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>',
  (rt: BotRuntime) => (args = '') => {
    const game = rt.conversationGame;
    if (!game) return 'ConversationGame not attached (System One must be enabled)';
    const focus = game.focus.getFocus();
    const reflexes = reflexesOf(game);
    const usage = 'Usage: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>';
    const toggle = (spec: ToggleReflexSpec) =>
      makeToggleReflex(reflexes, focus.disableReflex.bind(focus), spec);
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
);