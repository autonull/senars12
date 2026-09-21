import { GameFocus } from './GameFocus.js';
import type { Game } from '../game/Game.js';
import type { Reflex } from '../reflex/Reflex.js';

/**
 * P1 (N1): same-run NAL A/B — paired rule/no-rule episodes at the same seed;
 * the summary reports the veto's effect directly. Rule-free zero-vetoes and
 * rule-seeded vetoes are asserted by the falsification set (bench 15/44).
 */
export interface NalABResult {
  ruleReturn: number;
  noRuleReturn: number;
  vetoesWithRules: number;
  vetoesWithoutRules: number;
  /** Veto effect: return delta attributable to the seeded rule. */
  delta: number;
}

const playEpisode = async (game: Game, reflex: Reflex, seedRule: boolean, ticks: number): Promise<{ focus: GameFocus; total: number }> => {
  const focus = new GameFocus({ focusId: 'nal-ab', game, cognitive: true });
  if (seedRule) focus.seedRule(reflex.propose(game.state(), game.legalActions(game.state()))[0]!.action, 'nal_ab', { f: 0.1, c: 0.95 });
  focus.bindReflex(reflex);
  let total = 0;
  for (let t = 0; t < ticks; t++) {
    const { gameOutcome } = await focus.step(10);
    total += gameOutcome?.reward ?? 0;
  }
  return { focus, total };
};

export const runNalAB = async (
  makeGame: () => Game,
  makeReflex: () => Reflex,
  ticks = 20
): Promise<NalABResult> => {
  const withRules = await playEpisode(makeGame(), makeReflex(), true, ticks);
  const withoutRules = await playEpisode(makeGame(), makeReflex(), false, ticks);
  const vetoesWithRules = withRules.focus.getVetoStats().totalVetos;
  const vetoesWithoutRules = withoutRules.focus.getVetoStats().totalVetos;
  return {
    ruleReturn: withRules.total,
    noRuleReturn: withoutRules.total,
    vetoesWithRules,
    vetoesWithoutRules,
    delta: withRules.total - withoutRules.total,
  };
};
