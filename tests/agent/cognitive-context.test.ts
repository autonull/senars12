import {describe, expect, jest, test, beforeEach} from '@jest/globals';
import {CognitiveContextBuilder} from '../../src/agent/CognitiveContext.js';

describe('CognitiveContextBuilder', () => {
  let mockNar: any;

  beforeEach(() => {
    mockNar = {
      attentionReport: jest.fn(() => ({concepts: [], total: 0})),
      getBeliefs: jest.fn(() => []),
      getStatistics: jest.fn(() => ({totalConcepts: 0, totalTasks: 0})),
      getQuestions: jest.fn(() => []),
      getGoals: jest.fn(() => []),
      workingMemory: {size: jest.fn(() => 0)},
      listConcepts: jest.fn(() => []),
    };
  });

  describe('checkGoalSatisfaction', () => {
    test('returns satisfied=true when belief has truth.f > 0.8', () => {
      mockNar.getBeliefs.mockReturnValue([
        {term: {toString: () => '(bird --> animal)'}, truth: {f: 0.9, c: 0.8}},
      ]);
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(bird --> animal)');
      expect(result.satisfied).toBe(true);
      expect(result.truthFreq).toBe(0.9);
      expect(result.truthConf).toBe(0.8);
    });

    test('returns satisfied=false when belief has truth.f <= 0.8', () => {
      mockNar.getBeliefs.mockReturnValue([
        {term: {toString: () => '(bird --> animal)'}, truth: {f: 0.7, c: 0.8}},
      ]);
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(bird --> animal)');
      expect(result.satisfied).toBe(false);
    });

    test('returns satisfied=false when goal term has no matching belief', () => {
      mockNar.getBeliefs.mockReturnValue([
        {term: {toString: () => '(cat --> animal)'}, truth: {f: 0.9, c: 0.8}},
      ]);
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(bird --> animal)');
      expect(result.satisfied).toBe(false);
      expect(result.truthFreq).toBe(0);
      expect(result.truthConf).toBe(0);
    });

    test('returns satisfied=false when beliefs array is empty', () => {
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(bird --> animal)');
      expect(result.satisfied).toBe(false);
    });

    test('returns satisfied=true when belief exactly matches the threshold', () => {
      mockNar.getBeliefs.mockReturnValue([
        {term: {toString: () => '(cat --> mammal)'}, truth: {f: 0.8, c: 0.5}},
      ]);
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(cat --> mammal)');
      // 0.8 should NOT be > 0.8, strictly
      expect(result.satisfied).toBe(false);
    });

    test('handles multiple beliefs and finds the correct one', () => {
      mockNar.getBeliefs.mockReturnValue([
        {term: {toString: () => '(a --> b)'}, truth: {f: 0.5, c: 0.5}},
        {term: {toString: () => '(x --> y)'}, truth: {f: 0.95, c: 0.9}},
        {term: {toString: () => '(p --> q)'}, truth: {f: 0.6, c: 0.7}},
      ]);
      const builder = new CognitiveContextBuilder(mockNar);
      const result = builder.checkGoalSatisfaction('(x --> y)');
      expect(result.satisfied).toBe(true);
      expect(result.truthFreq).toBe(0.95);
      expect(result.truthConf).toBe(0.9);
    });
  });

  describe('primeAttention', () => {
    test('boosts priority of existing concepts', () => {
      const concept1 = {term: {toString: () => 'Apple'}, priority: 0.5};
      const concept2 = {term: {toString: () => 'Banana'}, priority: 0.3};
      mockNar.listConcepts.mockReturnValue([concept1, concept2]);
      const builder = new CognitiveContextBuilder(mockNar);
      builder.primeAttention('Apple, Banana');
      expect(concept1.priority).toBe(0.6);
      expect(concept2.priority).toBe(0.4);
    });

    test('caps priority at 1.0', () => {
      const concept = {term: {toString: () => 'Test'}, priority: 0.95};
      mockNar.listConcepts.mockReturnValue([concept]);
      const builder = new CognitiveContextBuilder(mockNar);
      builder.primeAttention('Test.');
      expect(concept.priority).toBe(1.0);
    });

    test('does nothing for terms without matching concepts', () => {
      mockNar.listConcepts.mockReturnValue([]);
      const builder = new CognitiveContextBuilder(mockNar);
      builder.primeAttention('Unknown');
    });

    test('handles empty input', () => {
      const builder = new CognitiveContextBuilder(mockNar);
      builder.primeAttention('');
    });
  });
});
