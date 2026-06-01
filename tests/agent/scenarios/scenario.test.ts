/**
 * Scenario Test Framework - Comprehensive Tests
 */

import {describe, expect, it, beforeEach, jest} from '@jest/globals';
import {SeNARSFactory} from '../../../src/nar/factory.js';
import {createSeNARSRegistry} from '../../../src/nar/lm/providers.js';
import {DEFAULT_NAR_CONFIG} from '../../../src/config/defaults.js';
import {ScenarioRunner, Scenarios} from '../../../src/agent/scenarios/ScenarioRunner.js';

jest.setTimeout(30000);

describe('ScenarioRunner: Core Functionality', () => {
  let runner: ScenarioRunner;

  beforeEach(() => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    runner = new ScenarioRunner(nar);
  });

  it('should run single test successfully', async () => {
    const result = await runner.run({
      id: 'basic-test',
      name: 'Basic Test',
      description: 'Simple belief test',
      steps: [
        { input: '<cat --> animal>.', type: 'belief' }
      ],
      type: 'single',
      category: 'test'
    });

    expect(result.testId).toBe('basic-test');
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.beliefs).toContain('(cat --> animal)');
  });

  it('should validate expectations', async () => {
    const result = await runner.run({
      id: 'expectation-test',
      name: 'Expectation Test',
      description: 'Test expectation validation',
      steps: [
        { input: '<A --> B>.', type: 'belief' },
        { input: '<B --> C>.', type: 'belief' }
      ],
      expectation: {
        contains: ['(A --> B)', '(B --> C)'],
        minDerivations: 2
      },
      type: 'single',
      category: 'test'
    });

    expect(result.details.some(d => d.description.includes('Contains'))).toBe(true);
  });

  it('should detect missing expectations', async () => {
    const result = await runner.run({
      id: 'missing-test',
      name: 'Missing Term Test',
      description: 'Test for missing term',
      steps: [
        { input: '<cat --> animal>.', type: 'belief' }
      ],
      expectation: {
        contains: ['dog']
      },
      type: 'single',
      category: 'test'
    });

    expect(result.passed).toBe(false);
  });

  it('should run parameter sweep', async () => {
    const result = await runner.run({
      id: 'param-sweep',
      name: 'Parameter Sweep',
      description: 'Test parameter sweep',
      steps: [
        { input: '<A --> B>.', type: 'belief' },
        { input: '<B --> C>.', type: 'belief' }
      ],
      type: 'parameter-sweep',
      parameters: {
        depth: { min: 1, max: 3, step: 1 }
      },
      category: 'benchmark'
    });

    expect(result.testId).toBe('param-sweep');
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.variants.length).toBeGreaterThan(0);
  });

  it('should compare variants', async () => {
    const result = await runner.run({
      id: 'ab-test',
      name: 'A/B Test',
      description: 'Variant comparison',
      steps: [
        { input: '<A --> B>.', type: 'belief' }
      ],
      type: 'prompt-ab',
      variants: [
        { name: 'Baseline' },
        { name: 'Variant A' }
      ],
      category: 'research'
    });

    expect(result.comparison).toBeDefined();
    expect(result.comparison!.baseline).toBe('Baseline');
  });
});

describe('ScenarioRunner: Predefined Scenarios', () => {
  let runner: ScenarioRunner;

  beforeEach(() => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    runner = new ScenarioRunner(nar);
  });

  it('should pass transitive inference test', async () => {
    const result = await runner.run(Scenarios.transitive(3));
    expect(result.passed).toBe(true);
    expect(result.beliefs.some(b => b.includes('A') && b.includes('C'))).toBe(true);
  });

  it('should pass operation misuse check', async () => {
    const result = await runner.run(Scenarios.operationMisuse());
    expect(result.passed).toBe(true);
    expect(result.beliefs.every(b => !b.includes('^'))).toBe(true);
  });

  it('should pass premise relevance test', async () => {
    const result = await runner.run(Scenarios.premiseRelevance());
    expect(result.passed).toBe(true);
    expect(result.derivations).toBeGreaterThan(0);
  });
});

describe('ScenarioRunner: Edge Cases', () => {
  let runner: ScenarioRunner;

  beforeEach(() => {
    const registry = createSeNARSRegistry();
    const nar = SeNARSFactory.createDefault({
      ...DEFAULT_NAR_CONFIG,
      providerRegistry: registry,
    });
    runner = new ScenarioRunner(nar);
  });

  it('should handle empty steps gracefully', async () => {
    const result = await runner.run({
      id: 'empty',
      name: 'Empty Test',
      description: 'Test with no steps',
      steps: [],
      type: 'single',
      category: 'test'
    });

    expect(result.testId).toBe('empty');
    expect(result.passed).toBe(true);
  });

  it('should handle invalid input gracefully', async () => {
    const result = await runner.run({
      id: 'invalid',
      name: 'Invalid Input',
      description: 'Test with invalid input',
      steps: [
        { input: 'not valid narsese', type: 'belief' }
      ],
      type: 'single',
      category: 'test'
    });

    expect(result.testId).toBe('invalid');
  });

  it('should track trajectory correctly', async () => {
    const result = await runner.run({
      id: 'trajectory',
      name: 'Trajectory Test',
      description: 'Test trajectory tracking',
      steps: [
        { input: '<A --> B>.', type: 'belief' },
        { input: '<B --> C>.', type: 'belief' }
      ],
      type: 'single',
      category: 'test'
    });

    expect(result.trajectory.length).toBe(2);
    expect(result.trajectory[0]!.step).toBe(0);
    expect(result.trajectory[1]!.step).toBe(1);
  });
});
