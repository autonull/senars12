import {describe, it, expect} from 'vitest';
import {Focus, createFocus} from '@senars/nar/focus';
import {FocusBag} from '@senars/nar/focus';
import {TabularQReflex} from '@senars/nar/reflex';
import {Negotiator} from '@senars/nar/reflex';
import {GridWorldGame, createGridWorldGame} from '@senars/nar/game';
import {GameFocus, createGameFocus} from '@senars/nar/focus';

describe('Focus-Game-Reflex Kernel - Slice 1', () => {
  describe('Focus', () => {
    it('should create focus with task and memory bags', () => {
      const focus = createFocus({
        id: 'test-focus',
        taskCapacity: 100,
        conceptCapacity: 50,
        weight: 1.0,
      });

      expect(focus.id).toBe('test-focus');
      expect(focus.weight).toBe(1.0);
      expect(focus.tasks.size()).toBe(0);
      expect(focus.memory.size()).toBe(0);
    });

    it('should step and process tasks', async () => {
      const focus = createFocus({id: 'step-focus'});

      const report = await focus.step(10);
      expect(report.focusId).toBe('step-focus');
      expect(report.cycle).toBe(1);
      expect(report.budgetAllocated).toBe(10);
    });

    it('should set weight', () => {
      const focus = createFocus({id: 'weight-focus', weight: 0.5});
      focus.setWeight(0.8);
      expect(focus.weight).toBe(0.8);
    });
  });

  describe('FocusBag', () => {
    it('should allocate budget by weight', () => {
      const focusBag = new FocusBag({capacity: 10});

      const focus1 = createFocus({id: 'f1', weight: 0.7});
      const focus2 = createFocus({id: 'f2', weight: 0.3});

      focusBag.add(focus1);
      focusBag.add(focus2);

      const budget1 = focusBag.allocateBudget(focus1, 100);
      const budget2 = focusBag.allocateBudget(focus2, 100);

      expect(budget1).toBe(70);
      expect(budget2).toBe(30);
    });

    it('should track total weight', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'f1', weight: 0.5});
      const focus2 = createFocus({id: 'f2', weight: 0.5});

      focusBag.add(focus1);
      focusBag.add(focus2);

      expect(focusBag.getTotalWeight()).toBe(1.0);
    });

    it('should rebalance weights', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'f1', weight: 0.5});
      const focus2 = createFocus({id: 'f2', weight: 0.5});

      focusBag.add(focus1);
      focusBag.add(focus2);

      focusBag.rebalanceWeights(new Map([['f1', 0.8], ['f2', 0.2]]));

      expect(focus1.weight).toBe(0.8);
      expect(focus2.weight).toBe(0.2);
    });
  });

  describe('TabularQReflex', () => {
    it('should propose actions with values', () => {
      const reflex = new TabularQReflex('test-q', {alpha: 0.1, gamma: 0.95, epsilon: 0.1});

      const proposals = reflex.propose({row: 0, col: 0}, [0, 1, 2, 3] as const);
      expect(proposals.length).toBe(4);
      expect(proposals[0].source).toBe('test-q');
      expect(proposals[0].value).toBeGreaterThanOrEqual(0);
      expect(proposals[0].confidence).toBeGreaterThanOrEqual(0);
    });

    it('should learn from events', () => {
      const reflex = new TabularQReflex('learn-q', {alpha: 0.5, gamma: 0.9, epsilon: 0});

      reflex.learn({
        perception: {stateId: '0,0', features: {}, confidence: 1, terminal: false},
        previousPerception: {stateId: '0,0', features: {}, confidence: 1, terminal: false},
        actionProposed: '0',
        actionExecuted: '0',
        reward: 1,
        terminal: false,
        overriddenBy: null,
      });

      // Use perception-based key to check Q-value
      const qValue = reflex.getQValue({stateId: '0,0', features: {}} as any, '0');
      expect(qValue).toBeGreaterThan(0);
    });
  });

  describe('Negotiator', () => {
    it('should select best reflex proposal', () => {
      const negotiator = new Negotiator();

      const proposals = [
        {action: 'up', value: 0.5, confidence: 0.8, source: 'reflex'},
        {action: 'right', value: 0.9, confidence: 0.7, source: 'reflex'},
        {action: 'down', value: 0.3, confidence: 0.9, source: 'reflex'},
      ];

      const decision = negotiator.resolve(proposals, []);
      expect(decision.action).toBe('right');
      expect(decision.source).toBe('reflex');
    });

    it('should veto when NAL derivation contradicts', () => {
      const negotiator = new Negotiator({nalVetoThreshold: 0.8});

      const proposals = [
        {action: 'left', value: 0.9, confidence: 0.9, source: 'reflex'},
      ];

      const nalDerivations = [
        {action: 'left', truth: {f: 0.0, c: 0.9}, source: 'trap-detection'},
      ];

      const decision = negotiator.resolve(proposals, nalDerivations);
      expect(decision.actionExecuted).toBeNull();
      expect(decision.vetoedBy).toBe('nal-trap-detection');
      expect(decision.source).toBe('nal');
    });
  });

  describe('GridWorldGame', () => {
    it('should wrap GridWorldEnv as Game interface', () => {
      const game = createGridWorldGame({
        id: 'test-grid',
        grid: ['S..', '...', '..G'],
        seed: 42,
      });

      expect(game.id).toBe('test-grid');

      const perception = game.observe();
      expect(perception.stateId).toBe('0,0');
      expect(perception.features).toBeDefined();
      expect(perception.confidence).toBe(1.0);

      const state = game.state();
      expect(state.row).toBe(0);
      expect(state.col).toBe(0);

      const actions = game.legalActions(state);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should step and return outcome', () => {
      const game = createGridWorldGame({
        id: 'step-grid',
        grid: ['S..', '...', '..G'],
        seed: 42,
      });

      const outcome = game.step(1); // right
      expect(outcome.reward).toBeDefined();
      expect(typeof outcome.terminal).toBe('boolean');
    });
  });

  describe('GameFocus', () => {
    it('should bind Game + Focus + run step', async () => {
      const game = createGridWorldGame({
        id: 'gf-grid',
        grid: ['S..', '...', '..G'],
        seed: 42,
      });

      const gameFocus = createGameFocus({
        focusId: 'gf-focus',
        game,
      });

      const reflex = new TabularQReflex('gf-q', {epsilon: 0});
      gameFocus.bindReflex(reflex);

      const {focusReport, gameOutcome} = await gameFocus.step(10);
      expect(focusReport.focusId).toBe('gf-focus');
      expect(focusReport.cycle).toBe(1);
      expect(gameOutcome).toBeDefined();
      expect(typeof gameOutcome?.reward).toBe('number');
    });

    it('should bind reflex and learn', async () => {
      const game = createGridWorldGame({
        id: 'gf-reflex-grid',
        grid: ['S..', '...', '..G'],
        seed: 42,
      });

      const gameFocus = createGameFocus({
        focusId: 'gf-reflex-focus',
        game,
      });

      const reflex = new TabularQReflex('gf-q', {epsilon: 0});
      gameFocus.bindReflex(reflex);

      const {focusReport, gameOutcome} = await gameFocus.step(10);
      expect(focusReport.gates.actions).toBeGreaterThanOrEqual(0);
      expect(gameOutcome).toBeDefined();
    });
  });
});