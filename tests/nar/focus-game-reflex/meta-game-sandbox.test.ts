import {describe, it, expect} from 'vitest';
import {createFocus} from '@senars/nar/focus';
import {FocusBag} from '@senars/nar/focus';
import {createGridWorldGame} from '@senars/nar/game';
import {createGameFocus} from '@senars/nar/focus';
import {TabularQReflex} from '@senars/nar/reflex';
import {MetaGame as MetaGameClass, createMetaGame} from '@senars/nar/game';
import {createSelfMetaGame, SelfMetaGameImpl} from '@senars/nar/game';
import {createMetaFocus} from '@senars/nar/focus';

describe('MetaGame Sandbox - Gate 5', () => {
  describe('MetaGame', () => {
    it('should create MetaGame observing specific focuses', () => {
      const metaGame = createMetaGame({
        id: 'meta-game',
        observesFocuses: ['gridworld', 'bandit'],
      });

      expect(metaGame.id).toBe('meta-game');
      expect(metaGame.observesFocuses).toEqual(['gridworld', 'bandit']);
    });

    it('should record and retrieve FocusStepReports', () => {
      const metaGame = createMetaGame({
        id: 'meta-game',
        observesFocuses: ['gridworld'],
      });

      const report = {
        focusId: 'gridworld',
        cycle: 1,
        budgetAllocated: 100,
        tasksProcessed: 10,
        derivations: 5,
        beliefsAdded: 3,
        goalsAdded: 1,
        questionsAdded: 1,
        gates: {perceptions: 2, actions: 1, rewards: 1},
        timestamp: Date.now(),
      };

      metaGame.recordFocusStepReport(report);

      const retrieved = metaGame.getFocusStepReport('gridworld');
      expect(retrieved).toEqual(report);

      const missing = metaGame.getFocusStepReport('nonexistent');
      expect(missing).toBeNull();
    });

    it('should observe focus reports in perception', () => {
      const metaGame = createMetaGame({
        id: 'meta-game',
        observesFocuses: ['gridworld', 'bandit'],
      });

      metaGame.recordFocusStepReport({
        focusId: 'gridworld',
        cycle: 1,
        budgetAllocated: 100,
        tasksProcessed: 10,
        derivations: 5,
        beliefsAdded: 3,
        goalsAdded: 1,
        questionsAdded: 1,
        gates: {perceptions: 2, actions: 1, rewards: 1},
        timestamp: Date.now(),
      });

      metaGame.recordFocusStepReport({
        focusId: 'bandit',
        cycle: 1,
        budgetAllocated: 50,
        tasksProcessed: 5,
        derivations: 3,
        beliefsAdded: 2,
        goalsAdded: 1,
        questionsAdded: 0,
        gates: {perceptions: 1, actions: 1, rewards: 1},
        timestamp: Date.now(),
      });

      const perception = metaGame.observe();
      expect(perception.features).toBeDefined();
      expect(perception.features?.['gridworld.derivations']).toBe(5);
      expect(perception.features?.['bandit.derivations']).toBe(3);
      expect(perception.features?.totalDerivations).toBe(8);
      expect(perception.features?.activeFocuses).toBe(2);
    });

    it('should provide legal actions for focus weight adjustment', () => {
      const metaGame = createMetaGame({
        id: 'meta-game',
        observesFocuses: ['gridworld'],
      });

      const actions = metaGame.legalActions(metaGame.state());
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.includes('^focus_weight'))).toBe(true);
      expect(actions.some((a) => a.includes('^knob_set'))).toBe(true);
    });
  });

  describe('SelfMetaGame', () => {
    it('should create SelfMetaGame with focus bag and game focuses', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.7});
      const focus2 = createFocus({id: 'bandit', weight: 0.3});
      focusBag.add(focus1);
      focusBag.add(focus2);

      const gameFocus1 = createGameFocus({
        focusId: 'gridworld',
        game: createGridWorldGame({id: 'gw', grid: ['S..', '...', '..G'], seed: 42}),
      });
      const gameFocus2 = createGameFocus({
        focusId: 'bandit',
        game: createGridWorldGame({id: 'bandit', grid: ['S..', '...', '..G'], seed: 42}),
      });

      const gameFocuses = new Map([
        ['gridworld', gameFocus1],
        ['bandit', gameFocus2],
      ]);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld', 'bandit'],
        focusBag,
        gameFocuses,
      });

      expect(selfMetaGame.id).toBe('self-meta');
      expect(selfMetaGame.observesFocuses).toEqual(['gridworld', 'bandit']);
    });

    it('should set focus weight via ^focus_weight', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.7});
      const focus2 = createFocus({id: 'bandit', weight: 0.3});
      focusBag.add(focus1);
      focusBag.add(focus2);

      const gameFocuses = new Map<string, any>();

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld', 'bandit'],
        focusBag,
        gameFocuses,
      });

      selfMetaGame.setFocusWeight('gridworld', 0.9);
      expect(focus1.weight).toBe(0.9);

      selfMetaGame.setFocusWeight('bandit', 0.1);
      expect(focus2.weight).toBe(0.1);
    });

    it('should clamp focus weight to [0, 1]', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses: new Map(),
      });

      selfMetaGame.setFocusWeight('gridworld', 1.5);
      expect(focus1.weight).toBe(1.0);

      selfMetaGame.setFocusWeight('gridworld', -0.5);
      expect(focus1.weight).toBe(0);
    });

    it('should set knob values via ^knob_set', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses: new Map(),
      });

      selfMetaGame.setKnob('maxDerivationsPerStep', 500);
      expect(selfMetaGame.getKnobValue('maxDerivationsPerStep')).toBe(500);

      selfMetaGame.setKnob('taskDecayRate', 0.05);
      expect(selfMetaGame.getKnobValue('taskDecayRate')).toBe(0.05);
    });

    it('should clamp knob values to configured range', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses: new Map(),
      });

      selfMetaGame.setKnob('maxDerivationsPerStep', 5000);
      expect(selfMetaGame.getKnobValue('maxDerivationsPerStep')).toBe(2000);

      selfMetaGame.setKnob('maxDerivationsPerStep', 5);
      expect(selfMetaGame.getKnobValue('maxDerivationsPerStep')).toBe(10);
    });

    it('should throw for unknown knobs', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses: new Map(),
      });

      expect(() => selfMetaGame.setKnob('unknownKnob', 100)).toThrow('Unknown knob');
    });

    it('should disable reflex in a GameFocus', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const game = createGridWorldGame({id: 'gw', grid: ['S..', '...', '..G'], seed: 42});
      const gameFocus = createGameFocus({focusId: 'gridworld', game});
      const reflex = new TabularQReflex('tabular-q', {epsilon: 0.1});
      gameFocus.bindReflex(reflex);

      const gameFocuses = new Map([['gridworld', gameFocus]]);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses,
      });

      expect(gameFocus.getFocus().reflexes.length).toBe(1);
      selfMetaGame.disableReflex('gridworld', 'tabular-q');
      expect(gameFocus.getFocus().reflexes.length).toBe(0);
    });

    it('should throw when disabling reflex in non-existent focus', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      focusBag.add(focus1);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses: new Map(),
      });

      expect(() => selfMetaGame.disableReflex('nonexistent', 'reflex')).toThrow('GameFocus not found');
    });
  });

  describe('MetaFocus', () => {
    it('should create MetaFocus with SelfMetaGame', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.7});
      focusBag.add(focus1);

      const gameFocuses = new Map<string, any>();

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses,
      });

      const metaFocus = createMetaFocus({
        id: 'meta-focus',
        selfMetaGame,
      });

      expect(metaFocus.id).toBe('meta-focus');
      expect(metaFocus.getSelfMetaGame()).toBe(selfMetaGame);
    });

    it('should step and incorporate focus reports into tasks', async () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.7});
      focusBag.add(focus1);

      const game = createGridWorldGame({id: 'gw', grid: ['S..', '...', '..G'], seed: 42});
      const gameFocus = createGameFocus({focusId: 'gridworld', game});
      const reflex = new TabularQReflex('tabular-q', {epsilon: 0.1});
      gameFocus.bindReflex(reflex);

      const gameFocuses = new Map([['gridworld', gameFocus]]);

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses,
      });

      const metaFocus = createMetaFocus({
        id: 'meta-focus',
        selfMetaGame,
      });

      await gameFocus.step(10);

      const report = await metaFocus.step(10);
      expect(report.focusId).toBe('meta-focus');
      expect(report.cycle).toBe(1);
      expect(report.tasksProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration: SelfMetaGame controlling FocusBag', () => {
    it('should rebalance focus weights and affect budget allocation', () => {
      const focusBag = new FocusBag({capacity: 10});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5});
      const focus2 = createFocus({id: 'bandit', weight: 0.5});
      focusBag.add(focus1);
      focusBag.add(focus2);

      const gameFocuses = new Map<string, any>();

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld', 'bandit'],
        focusBag,
        gameFocuses,
      });

      const initialBudget1 = focusBag.allocateBudget(focus1, 100);
      const initialBudget2 = focusBag.allocateBudget(focus2, 100);
      expect(initialBudget1).toBe(50);
      expect(initialBudget2).toBe(50);

      selfMetaGame.setFocusWeight('gridworld', 0.8);
      selfMetaGame.setFocusWeight('bandit', 0.2);

      const newBudget1 = focusBag.allocateBudget(focus1, 100);
      const newBudget2 = focusBag.allocateBudget(focus2, 100);
      expect(newBudget1).toBe(80);
      expect(newBudget2).toBe(20);
    });

    it('should apply knob changes to focus bags', () => {
      const focusBag = new FocusBag({capacity: 10, decayRate: 0.01});
      const focus1 = createFocus({id: 'gridworld', weight: 0.5, taskDecayRate: 0.01, conceptDecayRate: 0.005});
      focusBag.add(focus1);

      const gameFocuses = new Map<string, any>();

      const selfMetaGame = createSelfMetaGame({
        id: 'self-meta',
        observesFocuses: ['gridworld'],
        focusBag,
        gameFocuses,
      });

      expect(focusBag.decayRateValue).toBe(0.01);
      expect(focus1.tasks.decayRateValue).toBe(0.01);
      expect(focus1.memory.decayRateValue).toBe(0.005);

      selfMetaGame.setKnob('focusDecayRate', 0.02);
      selfMetaGame.setKnob('taskDecayRate', 0.05);
      selfMetaGame.setKnob('conceptDecayRate', 0.01);

      expect(focusBag.decayRateValue).toBe(0.02);
      expect(focus1.tasks.decayRateValue).toBe(0.05);
      expect(focus1.memory.decayRateValue).toBe(0.01);
    });
  });
});