import { describe, expect, it } from '@jest/globals';
import {
  PolicyOptimizer,
  PreferenceCollector,
  RewardModel,
  type TrajectoryStep,
} from '../../nar/src/rlfp';

describe('RewardModel', () => {
  it('should compute reward from trajectory', () => {
    const model = new RewardModel();
    const trajectory: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'llm_prompt', data: { messages: [] } },
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'search', args: {} } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'response' } },
    ];

    const reward = model.computeReward(trajectory);
    expect(typeof reward).toBe('number');
  });

  it('should extract features from trajectory', () => {
    const model = new RewardModel();
    const trajectory: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool2', args: {} } },
      { timestamp: Date.now(), type: 'lm_failure', data: { error: 'error' } },
    ];

    const features = model.extractFeatures(trajectory);
    expect(features.toolCallsCount).toBe(2);
    expect(features.errorCount).toBe(1);
    expect(features.hasErrors).toBe(true);
    expect(features.uniqueTools).toBe(2);
  });

  it('should compute reward from features', () => {
    const model = new RewardModel({
      lengthWeight: 0.1,
      toolUseWeight: 0.3,
      errorPenalty: -0.5,
    });

    const features = {
      trajectoryLength: 5,
      toolCallsCount: 2,
      lmResponsesCount: 1,
      hasErrors: false,
      errorCount: 0,
      completionLength: 100,
      uniqueTools: 2,
      avgToolResponseLength: 50,
    };

    const reward = model.computeRewardFromFeatures(features);
    expect(typeof reward).toBe('number');
  });

  it('should train from preferences', () => {
    const model = new RewardModel();
    const _collector = new PreferenceCollector();

    const trajectoryA: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'good response' } },
    ];

    const trajectoryB: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
    ];

    model.addPreferences({
      trajectoryA,
      trajectoryB,
      preference: 'A',
      timestamp: Date.now(),
      files: { A: 'a.json', B: 'b.json' },
    });

    const result = model.trainFromPreferences(10);
    expect(result).toHaveProperty('loss');
    expect(result).toHaveProperty('accuracy');
  });

  it('should compare two trajectories', () => {
    const model = new RewardModel();

    const trajectoryA: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'response A' } },
    ];

    const trajectoryB: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'response B' } },
    ];

    const comparison = model.compare(trajectoryA, trajectoryB);
    expect(comparison).toHaveProperty('rewardA');
    expect(comparison).toHaveProperty('rewardB');
    expect(comparison).toHaveProperty('preferred');
    expect(comparison).toHaveProperty('confidence');
    expect(['A', 'B', 'TIE']).toContain(comparison.preferred);
  });

  it('should predict reward and features', () => {
    const model = new RewardModel();
    const trajectory: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'calc', args: { op: 'add' } } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'result' } },
    ];

    const prediction = model.predict(trajectory);
    expect(prediction).toHaveProperty('reward');
    expect(prediction).toHaveProperty('features');
    expect(prediction.features.toolCallsCount).toBe(1);
  });
});

describe('PolicyOptimizer', () => {
  it('should create optimizer with reward model', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);
    expect(optimizer).toBeDefined();
  });

  it('should add and select strategies', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    optimizer.addStrategy('strategy1', new Map([['param1', 'value1']]));
    optimizer.addStrategy('strategy2', new Map([['param2', 'value2']]));

    const selected = optimizer.selectStrategy('test_context');
    expect(['strategy1', 'strategy2', 'default']).toContain(selected);
  });

  it('should record outcomes and update strategy stats', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    optimizer.addStrategy('test_strategy');

    const trajectory: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
    ];

    const reward = optimizer.recordOutcome(trajectory, 'test_strategy');
    expect(typeof reward).toBe('number');

    const stats = optimizer.getStrategyStats('test_strategy');
    expect(stats).toBeDefined();
    expect(stats?.avgReward).toBeGreaterThan(0);
  });

  it('should optimize strategies based on history', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    optimizer.addStrategy('strategy1');
    optimizer.addStrategy('strategy2');

    for (let i = 0; i < 15; i++) {
      const trajectory: TrajectoryStep[] = [
        { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
      ];
      optimizer.recordOutcome(trajectory, i % 2 === 0 ? 'strategy1' : 'strategy2');
    }

    const updates = optimizer.optimize(10);
    expect(Array.isArray(updates)).toBe(true);
  });

  it('should return all strategy names', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    optimizer.addStrategy('strategy1');
    optimizer.addStrategy('strategy2');

    const strategies = optimizer.getAllStrategies();
    expect(strategies).toHaveLength(2);
    expect(strategies).toContain('strategy1');
    expect(strategies).toContain('strategy2');
  });

  it('should get best strategy', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    expect(optimizer.getBestStrategy()).toBeNull();

    optimizer.addStrategy('test');
    const best = optimizer.getBestStrategy();
    expect(best).toBe('test');
  });

  it('should reset history', () => {
    const rewardModel = new RewardModel();
    const optimizer = new PolicyOptimizer(rewardModel);

    optimizer.addStrategy('test');
    const trajectory: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'tool1', args: {} } },
    ];
    optimizer.recordOutcome(trajectory, 'test');

    optimizer.reset();

    const stats = optimizer.getStrategyStats('test');
    expect(stats?.successRate).toBe(0);
    expect(stats?.avgReward).toBe(0);
  });
});

describe('PreferenceCollector - Implicit Detection', () => {
  it('should detect implicit preference from trajectories', () => {
    const collector = new PreferenceCollector();

    const trajectoryA: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'tool_call', data: { name: 'search', args: {} } },
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'detailed response' } },
    ];

    const trajectoryB: TrajectoryStep[] = [
      { timestamp: Date.now(), type: 'lm_response', data: { content: 'short' } },
    ];

    const preference = collector.detectImplicitPreference(trajectoryA, trajectoryB);
    expect(['A', 'B', 'SKIP']).toContain(preference);
  });

  it('should aggregate multiple preferences', () => {
    const collector = new PreferenceCollector();

    const prefs = [
      { preference: 'A' as const, weight: 1 },
      { preference: 'A' as const, weight: 1 },
      { preference: 'B' as const, weight: 1 },
    ];

    const result = collector.aggregatePreferences(prefs);
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('distribution');
    expect(result.distribution.A).toBeGreaterThan(result.distribution.B);
  });

  it('should handle empty preference aggregation', () => {
    const collector = new PreferenceCollector();
    const result = collector.aggregatePreferences([]);

    expect(result.result).toBe('SKIP');
    expect(result.confidence).toBe(0);
  });

  it('should set and get implicit weight', () => {
    const collector = new PreferenceCollector();

    collector.setImplicitWeight(0.5);
    expect(collector.getImplicitWeight()).toBe(0.5);

    collector.setImplicitWeight(1.5);
    expect(collector.getImplicitWeight()).toBe(1);

    collector.setImplicitWeight(-0.5);
    expect(collector.getImplicitWeight()).toBe(0);
  });
});
