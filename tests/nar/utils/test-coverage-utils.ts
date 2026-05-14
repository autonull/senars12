/**
 * Enhanced Test Utilities - DRY Patterns and Coverage Extensions
 * 
 * Provides parameterized test generators, enhanced builders, and coverage utilities
 */

import type {Budget, Task, TaskType, Term, Truth as TruthType} from '../../../src/nar';
import {Stamp, TermBuilder, Truth, createBudget as createBudgetFn, createTask as createTaskFn} from '../../../src/nar';

// =============================================================================
// Parameterized Test Generators
// =============================================================================

/**
 * Generates boundary test cases for numeric ranges
 */
export function generateBoundaryCases(params: {
  min?: number;
  max?: number;
  includeNegative?: boolean;
  includeZero?: boolean;
  includeNaN?: boolean;
  includeInfinity?: boolean;
}): Array<{value: number; description: string}> {
  const cases: Array<{value: number; description: string}> = [];
  
  if (params.includeNegative) {
    cases.push({value: -1, description: 'negative'});
    cases.push({value: -0.5, description: 'negative fraction'});
  }
  
  if (params.includeZero) {
    cases.push({value: 0, description: 'zero'});
  }
  
  if (params.min !== undefined) {
    cases.push({value: params.min, description: 'min boundary'});
    cases.push({value: params.min - 0.1, description: 'below min'});
  }
  
  if (params.max !== undefined) {
    cases.push({value: params.max, description: 'max boundary'});
    cases.push({value: params.max + 0.1, description: 'above max'});
  }
  
  if (params.includeNaN) {
    cases.push({value: NaN, description: 'NaN'});
  }
  
  if (params.includeInfinity) {
    cases.push({value: Infinity, description: 'Infinity'});
    cases.push({value: -Infinity, description: '-Infinity'});
  }
  
  // Add typical values
  cases.push({value: 0.5, description: 'typical'});
  
  return cases;
}

/**
 * Generates test cases for truth value combinations
 */
export function generateTruthCases(): Array<{
  f: number;
  c: number;
  description: string;
}> {
  return [
    {f: 0.0, c: 0.0, description: 'minimum values'},
    {f: 1.0, c: 1.0, description: 'maximum values'},
    {f: 0.5, c: 0.5, description: 'midpoint'},
    {f: 0.9, c: 0.9, description: 'high confidence'},
    {f: 0.1, c: 0.1, description: 'low confidence'},
    {f: -0.5, c: -0.5, description: 'negative values'},
    {f: 1.5, c: 1.5, description: 'overflow values'},
    {f: 0.7, c: 0.8, description: 'typical case'},
  ];
}

/**
 * Generates test cases for budget configurations
 */
export function generateBudgetCases(): Array<{
  priority: number;
  durability: number;
  quality: number;
  cycles: number;
  depth: number;
  description: string;
}> {
  return [
    {priority: 0.0, durability: 0.0, quality: 0.0, cycles: 0, depth: 0, description: 'minimum values'},
    {priority: 1.0, durability: 1.0, quality: 1.0, cycles: 10, depth: 5, description: 'maximum values'},
    {priority: 0.5, durability: 0.5, quality: 0.5, cycles: 5, depth: 2, description: 'midpoint'},
    {priority: 0.9, durability: 0.9, quality: 0.9, cycles: 8, depth: 4, description: 'high priority'},
    {priority: 0.1, durability: 0.1, quality: 0.1, cycles: 1, depth: 0, description: 'low priority'},
    {priority: -0.5, durability: -0.5, quality: -0.5, cycles: -1, depth: -1, description: 'negative values'},
    {priority: 1.5, durability: 1.5, quality: 1.5, cycles: 100, depth: 10, description: 'overflow values'},
  ];
}

// =============================================================================
// Enhanced Test Data Builders
// =============================================================================

/**
 * Fluent builder for complex test scenarios with chainable methods
 */
export class TestTaskBuilder {
  private term: Term;
  private type: TaskType;
  private truth: TruthType | undefined;
  private budget: Budget;
  private derived: boolean;
  private occurrenceTime: number;

  constructor() {
    this.term = TermBuilder.atom('test');
    this.type = 'belief';
    this.truth = Truth.create(0.5, 0.8);
    this.budget = createBudgetFn(0.5);
    this.derived = false;
    this.occurrenceTime = Date.now();
  }

  withTerm(term: Term): TestTaskBuilder {
    this.term = term;
    return this;
  }

  withType(type: TaskType): TestTaskBuilder {
    this.type = type;
    return this;
  }

  withTruth(frequency?: number, confidence?: number): TestTaskBuilder {
    this.truth = frequency !== undefined ? Truth.create(frequency, confidence ?? 0.8) : undefined;
    return this;
  }

  withBudget(priority?: number, durability?: number, quality?: number, cycles?: number, depth?: number): TestTaskBuilder {
    this.budget = createBudgetFn(priority, durability, quality, cycles, depth);
    return this;
  }

  withDerived(derived: boolean): TestTaskBuilder {
    this.derived = derived;
    return this;
  }

  withOccurrenceTime(time: number): TestTaskBuilder {
    this.occurrenceTime = time;
    return this;
  }

  withNow(): TestTaskBuilder {
    this.occurrenceTime = Date.now();
    return this;
  }

  build(): Task {
    return createTaskFn(
      this.term,
      this.type,
      this.truth!,
      this.budget,
      Stamp.createInput(),
      this.derived
    );
  }

  /**
   * Builds multiple tasks with variations
   */
  buildMany(count: number, variationFn?: (index: number) => Partial<Task>): Task[] {
    return Array.from({length: count}, (_, i) => {
      const variations = variationFn?.(i);
      const task = this.build();
      return variations ? {...task, ...variations} : task;
    });
  }
}

/**
 * Fluent builder for truth values
 */
export class TruthBuilder {
  private frequency: number;
  private confidence: number;

  constructor(frequency = 0.5, confidence = 0.8) {
    this.frequency = frequency;
    this.confidence = confidence;
  }

  static create(f?: number, c?: number): TruthBuilder {
    return new TruthBuilder(f, c);
  }

  withFrequency(f: number): TruthBuilder {
    this.frequency = f;
    return this;
  }

  withConfidence(c: number): TruthBuilder {
    this.confidence = c;
    return this;
  }

  high(): TruthBuilder {
    this.frequency = 0.9;
    this.confidence = 0.9;
    return this;
  }

  low(): TruthBuilder {
    this.frequency = 0.1;
    this.confidence = 0.1;
    return this; }

  neutral(): TruthBuilder {
    this.frequency = 0.5;
    this.confidence = 0.5;
    return this;
  }

  build(): TruthType {
    return Truth.create(this.frequency, this.confidence);
  }
}

// =============================================================================
// Validation Helpers with Better Error Messages
// =============================================================================

/**
 * Validates numeric value is within expected range with custom message
 */
export function expectInRange(value: number, min: number, max: number, prefix = 'Value'): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Validates truth value properties
 */
export function expectValidTruth(truth: TruthType, context?: string): void {
  expectInRange(truth.f, 0, 1, context ? `${context}.f` : 'truth.f');
  expectInRange(truth.c, 0, 1, context ? `${context}.c` : 'truth.c');
}

/**
 * Validates budget properties
 */
export function expectValidBudget(budget: Budget, context?: string): void {
  expect(budget.priority).toBeDefined();
  expect(budget.durability).toBeDefined();
  expect(budget.quality).toBeDefined();
  expect(budget.cycles).toBeGreaterThanOrEqual(0);
  expect(budget.depth).toBeGreaterThanOrEqual(0);
}

/**
 * Validates array length with descriptive error
 */
export function expectArrayLength<T>(array: T[], expected: number, context?: string): void {
  expect(array).toHaveLength(expected);
}

/**
 * Validates array is sorted in descending order
 */
export function expectDescendingOrder<T extends {priority?: number}>(items: T[], context = 'Array'): void {
  for (let i = 1; i < items.length; i++) {
    expect(items[i].priority ?? 0).toBeLessThanOrEqual(items[i - 1].priority ?? 0);
  }
}

// =============================================================================
// Test Coverage Utilities
// =============================================================================

/**
 * Creates a matrix of test cases for comprehensive coverage
 */
export function createTestMatrix<T>(
  dimensions: Record<string, T[]>,
  combine: (...args: T[]) => Record<string, unknown>
): Array<Record<string, unknown>> {
  const keys = Object.keys(dimensions);
  const result: Array<Record<string, unknown>> = [];

  function generateCombinations(index: number, current: Record<string, unknown>): void {
    if (index === keys.length) {
      result.push(current);
      return;
    }

    const key = keys[index]!;
    const values = dimensions[key]!;
    
    for (const value of values) {
      generateCombinations(index + 1, {...current, [key]: value});
    }
  }

  generateCombinations(0, {});
  return result;
}

/**
 * Helper for exhaustive edge case testing
 */
export function withEdgeCases<T>(baseCases: T[], edgeCases: T[]): T[] {
  return [...baseCases, ...edgeCases];
}

// =============================================================================
// Re-exports from test-helpers.ts for convenience
// =============================================================================

export * from './test-helpers';
