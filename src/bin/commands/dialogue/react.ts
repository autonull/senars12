/** Bind a reaction to the last turn */

import { attempted, cmd } from '@senars/cli';
import { tokenize } from '../args';
import { REACTION_SET, REACTION_USAGE, isCorrection } from './constants';
import type { BotRuntime } from '../context';

export const reactCommand = cmd(
  'react',
  `Bind a reaction to the last turn: ${REACTION_USAGE}`,
  (rt: BotRuntime) => async (args = '') => {
    const [kind, ...rest] = tokenize(args);
    const turn = rt.dialogue.latestTurn();
    if (!turn) return 'No captured turn to react to (capture disabled or no exchange yet).';
    if (!kind || !REACTION_SET.has(kind)) return `Usage: ${REACTION_USAGE}`;
    const correction = kind === 'correct' ? rest.join(' ') : undefined;
    if (kind === 'correct' && !correction) return 'Usage: .react correct <correction text>';
    return attempted('react ', async () => {
      await rt.dialogue.bindReaction(turn.turnId, kind as never, correction);
      // Reactions are verification signals for the user channel: trust-not-truth.
      rt.wired.nar
        .getSourceReputation?.()
        ?.record('user', isCorrection(kind) ? 'contradicted' : 'confirmed');
      return `Reaction ${kind} bound to ${turn.turnId}${kind === 'correct' ? ' (embedded + labeled, text discarded)' : ''}`;
    });
  }
);