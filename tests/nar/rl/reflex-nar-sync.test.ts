/**
 * Reflex↔NAR Sync Unit Test (2D)
 *
 * Verifies that TabularQReflex Q-table updates are immediately visible
 * to Negotiator.resolve() before the next step (no stale read).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TabularQReflex } from '@senars/nar/reflex/TabularQReflex.js';
import { Negotiator } from '@senars/nar/reflex/Negotiator.js';
import type { ActionProposal, LearningEvent } from '@senars/nar/reflex/Reflex.js';
import type { NALDerivation } from '@senars/nar/reflex/Negotiator.js';
import type { GridWorldState } from '@senars/nar/game/GridWorldEnv.js';
import type { Perception } from '@senars/nar/game';

describe('Reflex↔NAR Sync (2D)', () => {
  let reflex: TabularQReflex;
  let negotiator: Negotiator;

  beforeEach(() => {
    reflex = new TabularQReflex('test-reflex', { alpha: 0.1, gamma: 0.95, epsilon: 0 });
    negotiator = new Negotiator({ nalVetoThreshold: 0.8, reflexThreshold: -1 });
  });

  const createGridWorldState = (row: number, col: number): GridWorldState => ({ row, col, goalRow: 3, goalCol: 3 });
  const createPerception = (stateId: string): Perception => ({
    stateId,
    features: {},
    confidence: 1.0,
    terminal: false,
  });

  it('should immediately reflect Q-table updates in Negotiator.resolve()', async () => {
    const state = createGridWorldState(0, 0);
    const legalActions = [0, 1, 2, 3];

    // Initial proposals - all Q-values are 0
    const initialProposals = reflex.propose(state, legalActions);
    expect(initialProposals.every((p) => p.value === 0)).toBe(true);

    // Simulate a learning event that updates Q-value for action 0
    // Use the same stateId format as GridWorld ("row,col")
    const learningEvent: LearningEvent = {
      perception: createPerception('0,1'),
      previousPerception: createPerception('0,0'),
      actionProposed: '0',
      actionExecuted: '0',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    };

    reflex.learn(learningEvent);

    // Verify Q-table was updated
    const qValueAfterLearn = reflex.getQValue(state, 0);
    expect(qValueAfterLearn).toBeGreaterThan(0);

    // Create new proposals - should reflect updated Q-value
    const updatedProposals = reflex.propose(state, legalActions);
    const action0Proposal = updatedProposals.find((p) => p.action === '0');
    expect(action0Proposal).toBeDefined();
    expect(action0Proposal!.value).toBeCloseTo(qValueAfterLearn, 5);

    // Negotiator should see the updated value immediately
    const nalDerivations: NALDerivation[] = [];
    const decision = negotiator.resolve(updatedProposals, nalDerivations);

    // The best action should now be action 0 (highest Q-value)
    expect(decision.actionExecuted).toBe('0');
    expect(decision.source).toBe('reflex');
  });

  it('should not have stale reads when multiple updates occur in sequence', async () => {
    const state = createGridWorldState(1, 1);
    const legalActions = [0, 1, 2, 3];

    // Learn action 1
    reflex.learn({
      perception: createPerception('1,2'),
      previousPerception: createPerception('1,1'),
      actionProposed: '1',
      actionExecuted: '1',
      reward: 0.5,
      terminal: false,
      overriddenBy: null,
    });

    // Learn action 2 (higher reward)
    reflex.learn({
      perception: createPerception('2,1'),
      previousPerception: createPerception('1,1'),
      actionProposed: '2',
      actionExecuted: '2',
      reward: 1.0,
      terminal: false,
      overriddenBy: null,
    });

    // Propose again - action 2 should be highest
    const proposals = reflex.propose(state, legalActions);
    const action2Proposal = proposals.find((p) => p.action === '2');
    const action1Proposal = proposals.find((p) => p.action === '1');

    expect(action2Proposal!.value).toBeGreaterThan(action1Proposal!.value);

    // Negotiator should pick action 2
    const decision = negotiator.resolve(proposals, []);
    expect(decision.actionExecuted).toBe('2');
  });

  it('should handle NAL veto correctly after reflex update', async () => {
    const state = createGridWorldState(2, 2);
    const legalActions = [0, 1, 2, 3];

    // Learn action 0 with high reward
    reflex.learn({
      perception: createPerception('2,3'),
      previousPerception: createPerception('2,2'),
      actionProposed: '0',
      actionExecuted: '0',
      reward: 1.0,
      terminal: false,
      overriddenBy: null,
    });

    const proposals = reflex.propose(state, legalActions);

    // Create NAL derivation that vetoes action 0 (low frequency, high confidence)
    const nalDerivations: NALDerivation[] = [
      {
        action: '0',
        truth: { f: 0.2, c: 0.9 }, // f < 0.3, c >= 0.8 -> veto
        source: 'test-nal-rule',
      },
    ];

    const decision = negotiator.resolve(proposals, nalDerivations);

    // Action 0 should be vetoed, next best should be chosen
    expect(decision.actionExecuted).not.toBe('0');
    expect(decision.vetoedBy).toContain('test-nal-rule');
    expect(decision.source).toBe('nal');
  });

  it('should maintain consistency across multiple propose/learn cycles', async () => {
    const state = createGridWorldState(3, 3);
    const legalActions = [0, 1, 2, 3];

    for (let i = 0; i < 10; i++) {
      // Propose
      const proposals = reflex.propose(state, legalActions);

      // Negotiate
      const decision = negotiator.resolve(proposals, []);

      // Learn from outcome (simulate reward for chosen action)
      if (decision.actionExecuted) {
        reflex.learn({
          perception: createPerception(`${i},${i+1}`),
          previousPerception: createPerception('3,3'),
          actionProposed: decision.actionExecuted,
          actionExecuted: decision.actionExecuted,
          reward: 0.1,
          terminal: false,
          overriddenBy: null,
        });
      }

      // Verify immediate consistency
      const nextProposals = reflex.propose(state, legalActions);
      const executedProposal = nextProposals.find((p) => p.action === decision.actionExecuted);
      const qValue = reflex.getQValue(state, decision.actionExecuted!);
      expect(executedProposal!.value).toBeCloseTo(qValue, 5);
    }
  });

  it('should correctly report visit counts after learning', async () => {
    const state = createGridWorldState(4, 4);
    const legalActions = [0, 1, 2, 3];

    expect(reflex.getVisitCount(state, 0)).toBe(0);

    reflex.learn({
      perception: createPerception('4,5'),
      previousPerception: createPerception('4,4'),
      actionProposed: '0',
      actionExecuted: '0',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    });

    expect(reflex.getVisitCount(state, 0)).toBe(1);

    reflex.learn({
      perception: createPerception('4,5'),
      previousPerception: createPerception('4,4'),
      actionProposed: '0',
      actionExecuted: '0',
      reward: 1,
      terminal: false,
      overriddenBy: null,
    });

    expect(reflex.getVisitCount(state, 0)).toBe(2);

    // Proposals should reflect visit count in confidence
    const proposals = reflex.propose(state, legalActions);
    const action0Proposal = proposals.find((p) => p.action === '0');
    expect(action0Proposal!.confidence).toBeGreaterThan(0);
  });
});