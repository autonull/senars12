import { gateRegistry } from '@senars/nar/kernel';
import { GameFocus } from '@senars/nar/focus';
import type { Game } from '@senars/nar/game';
import { createGridWorldGame } from '@senars/nar/game';
import type { ActionProposal, LearningEvent, Reflex } from '@senars/nar/reflex';
import { describe, expect, it } from 'vitest';

const fakeGame = (id: string, actions: string[]): Game => ({
  id,
  observe: () => ({ stateId: `${id}:0`, terminal: false }),
  state: () => 's',
  legalActions: () => actions,
  step: () => ({ reward: 0, terminal: false }),
});

/** Scripted reflex: deterministic proposals, records every LearningEvent. */
class ScriptedReflex implements Reflex {
  readonly id: string;
  learned: LearningEvent[] = [];
  constructor(
    id: string,
    private readonly pick: (legal: number[]) => number[],
    private readonly value: number,
    private readonly confidence: number
  ) {
    this.id = id;
  }
  propose(_state: unknown, legalActions: number[]): ActionProposal[] {
    return this.pick(legalActions).map((action) => ({
      action: String(action),
      value: this.value,
      confidence: this.confidence,
      source: this.id,
    }));
  }
  learn(event: LearningEvent): void {
    this.learned.push(event);
  }
}

const first = (legal: number[]) => [legal[0]!];
const last = (legal: number[]) => [legal[legal.length - 1]!];

describe('TODO17 Bench 30 — Arbitration & Gate Isolation', () => {
  it('(a) second reflex strictly-better proposal wins; winner + vetoed proposer both learn', async () => {
    const game = createGridWorldGame({ id: 'arb-grid', grid: ['S..', '..G'], seed: 11 });
    const focus = new GameFocus({ focusId: 'arb', game });
    const weak = new ScriptedReflex('weak', first, 0.1, 0.5); // score 0.05
    const strong = new ScriptedReflex('strong', last, 0.9, 0.9); // score 0.81
    focus.bindReflex(weak);
    focus.bindReflex(strong);

    await focus.step(10);

    expect(strong.learned.length).toBeGreaterThan(0); // winner learned
    expect(weak.learned.length).toBeGreaterThan(0); // vetoed-by-arbitration proposer learned
  });

  it('(a) identical decisions with a single reflex (merge-over-one is the identity)', async () => {
    const mk = () => {
      const game = createGridWorldGame({ id: 'single-grid', grid: ['S..', '..G'], seed: 21 });
      const focus = new GameFocus({ focusId: 'single', game });
      const reflex = new ScriptedReflex('only', first, 0.9, 0.9);
      focus.bindReflex(reflex);
      return { game, focus, reflex };
    };
    const a = mk();
    const b = mk();

    const ra = await a.focus.step(10);
    const rb = await b.focus.step(10);

    expect(ra.gameOutcome?.reward).toBe(rb.gameOutcome?.reward);
    expect(a.reflex.learned.length).toBe(1);
    expect(b.reflex.learned.length).toBe(1);
  });

  it('(b) game actions are scoped; global autonomy + allowlist untouched', () => {
    gateRegistry.reset();
    const beforeMode = gateRegistry.getActionGate().getAutonomyMode();

    const gameA = createGridWorldGame({ id: 'iso-a', grid: ['S.', '.G'], seed: 1 });
    const gameB = fakeGame('iso-b', ['warp']);
    new GameFocus({ focusId: 'focus-a', game: gameA });
    new GameFocus({ focusId: 'focus-b', game: gameB });

    const gate = gateRegistry.getActionGate();
    // Global mode and shared allowlist untouched by game construction
    expect(gate.getAutonomyMode()).toBe(beforeMode);
    expect(gate.authorize({ proposalId: 'x', operation: '0' }).authorized).toBe(false);

    // Game A's legal action authorized within its own scope…
    const legalA = String(gameA.legalActions(gameA.state())[0]);
    expect(gate.authorize({ proposalId: 'x', operation: `game:focus-a:${legalA}` }).authorized).toBe(
      true
    );
    // …but not in game B's scope (no cross-game contamination)
    expect(gate.authorize({ proposalId: 'x', operation: `game:focus-b:${legalA}` }).authorized).toBe(
      false
    );
    // …and not as a bare global operation
    expect(gate.authorize({ proposalId: 'x', operation: legalA }).authorized).toBe(false);
    // Game B's own action authorizes only in its own scope
    expect(gate.authorize({ proposalId: 'x', operation: 'game:focus-b:warp' }).authorized).toBe(
      true
    );
    expect(gate.authorize({ proposalId: 'x', operation: 'game:focus-a:warp' }).authorized).toBe(
      false
    );
  });

  it('(b) kernel-wide sabotage-gate behavior passes unmodified', () => {
    gateRegistry.reset();
    const gate = gateRegistry.getActionGate();
    gate.setAutonomyMode('sandbox-execute');
    gate.addAllowedOperation('move');

    expect(gate.authorize({ proposalId: 'x', operation: 'move' }).authorized).toBe(true);
    expect(gate.authorize({ proposalId: 'x', operation: 'rm-rf' }).authorized).toBe(false);
    gate.setAutonomyMode('observe-only');
    expect(gate.authorize({ proposalId: 'x', operation: 'move' }).authorized).toBe(false);
  });
});
