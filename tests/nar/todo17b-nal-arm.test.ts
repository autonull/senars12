/**
 * TODO17b addendum: NAL as a first-class Arcade arm (§9). Falsification:
 * the Negotiator's veto must prevent known-trap actions when rules exist
 * (Bench 15 semantics) and must fire ZERO vetoes when no rules exist —
 * an unseeded veto that reduces return is a regression, not a safety net.
 */
import { GameFocus } from '@senars/nar/focus';
import { induceEpisodeSchemas, type EpisodeTick } from '@senars/nar/focus/schema-induction';
import { createBanditGame, createGridWorldGame, type Game } from '@senars/nar/game';
import type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
import { Negotiator } from '@senars/nar/reflex';
import { describe, expect, it } from 'vitest';

/** Scripted reflex that always proposes one action at high confidence. */
class FixedActionReflex implements Reflex {
  readonly id = 'fixed-action';
  constructor(
    private readonly action: string,
    private readonly confidence = 0.9
  ) {}
  propose(): ActionProposal[] {
    return [{ action: this.action, value: 0.9, confidence: this.confidence, source: this.id }];
  }
  learn(_event: LearningEvent): void {}
}

const playTicks = async (game: Game, seeded: boolean, ticks = 20): Promise<GameFocus> => {
  const focus = new GameFocus({ focusId: 'nal-arm', game, cognitive: true });
  if (seeded) focus.seedRule('0', 'wall_bump', { f: 0.1, c: 0.95 });
  focus.bindReflex(new FixedActionReflex('0'));
  for (let t = 0; t < ticks; t++) await focus.step(10);
  return focus;
};

describe('TODO17b: NAL arcade arm falsification', () => {
  it('seeded trap rule ⇒ the trap action is vetoed and never executed', async () => {
    const focus = await playTicks(createGridWorldGame({ id: 'nal-grid', grid: ['S..', '..G'], seed: 5 }), true);
    const panel = focus.getPanelLog();
    expect(focus.getVetoStats().totalVetos).toBeGreaterThanOrEqual(1);
    for (const entry of panel) {
      if (entry.decision.source === 'nal') {
        expect(entry.decision.vetoedBy).toMatch(/^nal-/);
        expect(entry.decision.actionExecuted).toBeNull();
      }
      expect(entry.decision.actionExecuted).not.toBe('0');
    }
  });

  it('no rules ⇒ zero vetoes (NAL cannot reduce return without faults)', async () => {
    const focus = await playTicks(createGridWorldGame({ id: 'nal-clean', grid: ['S..', '..G'], seed: 5 }), false);
    const stats = focus.getVetoStats();
    expect(stats.totalVetos).toBe(0);
    // the same trap action now executes (rule-free behavior unchanged)
    expect(focus.getPanelLog().some((p) => p.decision.actionExecuted === '0')).toBe(true);
  });

  it('bandit arm-0 rule: worst arm is never executed under veto', async () => {
    const game = createBanditGame({ seed: 7, armMeans: [0.2, 0.5, 0.8], numArms: 3 });
    const focus = new GameFocus({ focusId: 'nal-bandit', game, cognitive: true });
    focus.seedRule('0', 'low_reward', { f: 0.1, c: 0.95 });
    focus.bindReflex(new FixedActionReflex('0'));
    for (let t = 0; t < 15; t++) await focus.step(10);
    expect(focus.getVetoStats().totalVetos).toBeGreaterThanOrEqual(1);
    expect(focus.getPanelLog().every((p) => p.decision.actionExecuted !== '0')).toBe(true);
  });

  it('a derivation about action A never vetoes proposal B (negotiator action match)', () => {
    const negotiator = new Negotiator();
    const proposals: ActionProposal[] = [
      { action: '1', value: 0.9, confidence: 0.9, source: 'reflex' },
      { action: '0', value: 0.8, confidence: 0.9, source: 'reflex' },
    ];
    const clean = negotiator.resolve(proposals, []);
    expect(clean.actionExecuted).toBe('1');
    // unrelated bad-action derivation must NOT veto the best proposal
    const mismatched = negotiator.resolve(proposals, [
      { action: '0', truth: { f: 0.1, c: 0.95 }, source: 'rule' },
    ]);
    expect(mismatched.actionExecuted).toBe('1');
    expect(mismatched.vetoedBy).toBeNull();
    // matching bad-action derivation DOES veto (single proposal ⇒ tick yields)
    const matched = negotiator.resolve([{ ...proposals[0]!, action: '0' }], [
      { action: '0', truth: { f: 0.1, c: 0.95 }, source: 'rule' },
    ]);
    expect(matched.vetoedBy).toBe('nal-rule');
    expect(matched.actionExecuted).toBeNull();

    // veto with fallback: trap blocked, best remaining proposal acts
    const fallback = negotiator.resolve(
      [
        { action: '0', value: 0.9, confidence: 0.9, source: 'reflex' },
        { action: '1', value: 0.8, confidence: 0.9, source: 'reflex' },
      ],
      [{ action: '0', truth: { f: 0.1, c: 0.95 }, source: 'rule' }]
    );
    expect(fallback.action).toBe('0');
    expect(fallback.actionExecuted).toBe('1');
    expect(fallback.vetoedBy).toBe('nal-rule');
    expect(fallback.source).toBe('nal');
  });

  it('schema induction promotes experience into veto-eligible bad_outcome rules (G2 loop)', async () => {
    const history: EpisodeTick[] = [
      { action: '0', reward: -1 },
      { action: '0', reward: -1 },
      { action: '1', reward: 1 },
      { action: '1', reward: 1 },
    ];
    const schemas = induceEpisodeSchemas(history);
    expect(schemas).toContainEqual({ action: '0', kind: 'bad', meanReward: -1 });
    expect(schemas).toContainEqual({ action: '1', kind: 'good', meanReward: 1 });
    const focus = new GameFocus({
      focusId: 'nal-induced',
      game: createGridWorldGame({ id: 'nal-induced-grid', grid: ['S..', '..G'], seed: 5 }),
      cognitive: true,
    });
    for (const s of schemas)
      focus.seedRule(s.action, s.kind === 'bad' ? 'bad_outcome' : 'good_outcome', {
        f: Math.max(0, Math.min(1, s.meanReward)),
        c: 0.9,
      });
    focus.bindReflex(new FixedActionReflex('0'));
    for (let t = 0; t < 15; t++) await focus.step(10);
    expect(focus.getPanelLog().every((p) => p.decision.actionExecuted !== '0')).toBe(true);
  });
});
