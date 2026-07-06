/**
 * PriorityUtils Tests
 */

import {describe, expect, it} from '@jest/globals';
import {PriorityCalculator} from '@senars/core/src/util/PriorityUtils';

describe('PriorityUtils', () => {
    describe('PriorityCalculator', () => {
        describe('calculate', () => {
            it('should calculate weighted priority', () => {
                const factors = {activation: 0.8, confidence: 0.9};
                const weights = {activationWeight: 0.6, confidenceWeight: 0.4};
                const result = PriorityCalculator.calculate(factors, weights);
                expect(result).toBeGreaterThan(0);
                expect(result).toBeLessThanOrEqual(1);
            });

            it('should handle default weights', () => {
                const factors = {activation: 0.8};
                const result = PriorityCalculator.calculate(factors);
                expect(result).toBeDefined();
            });

            it('should handle empty input', () => {
                const result = PriorityCalculator.calculate();
                expect(result).toBeDefined();
            });

            it('should normalize priority to max', () => {
                const factors = {activation: 2.0};
                const weights = {activationWeight: 1.0};
                const result = PriorityCalculator.calculate(factors, weights);
                expect(result).toBeLessThanOrEqual(1.0);
            });

            it('should respect minPriority option', () => {
                const factors = {activation: 0};
                const weights = {activationWeight: 1.0};
                const options = {minPriority: 0.1};
                const result = PriorityCalculator.calculate(factors, weights, options);
                expect(result).toBeGreaterThanOrEqual(0.1);
            });
        });

        describe('calculateInputPriority', () => {
            it('should calculate input priority with goal boost', () => {
                const inputFactors = {
                    truthValue: {confidence: 0.85},
                    taskType: 'GOAL'
                };
                const config = {
                    basePriority: 0.5,
                    goalBoost: 0.2
                };
                const result = PriorityCalculator.calculateInputPriority(inputFactors, config);
                expect(result).toBeGreaterThan(0.5);
            });

            it('should handle belief task type', () => {
                const inputFactors = {
                    truthValue: {confidence: 0.85},
                    taskType: 'BELIEF'
                };
                const config = {basePriority: 0.5};
                const result = PriorityCalculator.calculateInputPriority(inputFactors, config);
                expect(result).toBeDefined();
            });

            it('should handle question task type', () => {
                const inputFactors = {
                    taskType: 'QUESTION'
                };
                const config = {
                    basePriority: 0.5,
                    questionBoost: 0.1
                };
                const result = PriorityCalculator.calculateInputPriority(inputFactors, config);
                expect(result).toBeGreaterThan(0.5);
            });

            it('should apply complexity penalty', () => {
                const inputFactors = {
                    taskType: 'BELIEF',
                    complexity: 2
                };
                const config = {basePriority: 0.8};
                const result = PriorityCalculator.calculateInputPriority(inputFactors, config);
                expect(result).toBeLessThan(0.8);
            });

            it('should handle empty input', () => {
                const result = PriorityCalculator.calculateInputPriority();
                expect(result).toBeDefined();
            });

            it('should respect maxPriority', () => {
                const inputFactors = {
                    truthValue: {confidence: 1.0},
                    taskType: 'GOAL'
                };
                const config = {
                    basePriority: 0.9,
                    goalBoost: 0.5,
                    maxPriority: 1.0
                };
                const result = PriorityCalculator.calculateInputPriority(inputFactors, config);
                expect(result).toBeLessThanOrEqual(1.0);
            });
        });

        describe('calculateCompositeScore', () => {
            it('should calculate composite score from metrics', () => {
                const metrics = {
                    activation: 0.7,
                    useCount: 50,
                    totalTasks: 25
                };
                const result = PriorityCalculator.calculateCompositeScore(metrics);
                expect(result).toBeDefined();
            });

            it('should handle missing metrics', () => {
                const result = PriorityCalculator.calculateCompositeScore({});
                expect(result).toBeDefined();
                expect(result.compositeScore).toBe(0);
            });

            it('should handle null input', () => {
                expect(() => PriorityCalculator.calculateCompositeScore(null)).toThrow();
            });
        });
    });
});
