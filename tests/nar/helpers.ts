/**
 * Test Utilities - Common helpers and utilities for NARS12 tests
 * DRY patterns for task creation, term building, and test assertions
 */

import type {Budget, Task, TaskType, Term, Truth as TruthType} from '../../src/nar/types';
import {Stamp, TermBuilder, Truth, createBudget} from '../../src/nar';

// ============================================================================
// Task Creation Helpers
// ============================================================================

/**
 * Creates a standardized test task with configurable properties
 */
export function createTestTask(options: {
  term?: Term;
  termStr?: string;
  type?: TaskType;
  frequency?: number;
  confidence?: number;
  priority?: number;
  durability?: number;
  quality?: number;
  occurrenceTime?: number;
  derived?: boolean;
}): Task {
  const {
    term,
    termStr,
    type = 'belief',
    frequency = 0.9,
    confidence = 0.9,
    priority = 0.8,
    durability = 0.7,
    quality = 0.85,
    occurrenceTime = Date.now(),
    derived = false
  } = options;

  if (!term && !termStr) {
    throw new Error('Either term or termStr must be provided');
  }

  const taskTerm = term || TermBuilder.atom(termStr!);

  return {
    term: taskTerm,
    type,
    truth: Truth.create(frequency, confidence),
    budget: createBudget(priority, durability, quality),
    stamp: Stamp.createInput(),
    occurrenceTime,
    derived
  };
}

/**
 * Creates a belief task (most common case)
 */
export function createBelief(
  term: Term | string,
  options?: {
    frequency?: number;
    confidence?: number;
    priority?: number;
    durability?: number;
    quality?: number;
  }
): Task {
  const isString = typeof term === 'string';
  return createTestTask({
    term: isString ? undefined : term,
    termStr: isString ? term : undefined,
    type: 'belief',
    ...options
  });
}

/**
 * Creates a goal task
 */
export function createGoal(
  term: Term | string,
  options?: {
    frequency?: number;
    confidence?: number;
    priority?: number;
    durability?: number;
    quality?: number;
  }
): Task {
  const isString = typeof term === 'string';
  return createTestTask({
    term: isString ? undefined : term,
    termStr: isString ? term : undefined,
    type: 'goal',
    ...options
  });
}

/**
 * Creates a question task
 */
export function createQuestion(
  term: Term | string,
  options?: {
    priority?: number;
    durability?: number;
    quality?: number;
  }
): Task {
  const isString = typeof term === 'string';
  return createTestTask({
    term: isString ? undefined : term,
    termStr: isString ? term : undefined,
    type: 'question',
    ...options
  });
}

// ============================================================================
// Term Creation Helpers
// ============================================================================

/**
 * Creates an inheritance term (sub --> sup)
 */
export function inh(sub: string, sup: string): Term {
  return TermBuilder.inheritance(TermBuilder.atom(sub), TermBuilder.atom(sup));
}

/**
 * Creates a similarity term (sub <-> sup)
 */
export function sim(sub: string, sup: string): Term {
  return TermBuilder.similarity(TermBuilder.atom(sub), TermBuilder.atom(sup));
}

/**
 * Creates an intersection term (&&, term1, term2)
 */
export function intersection(...terms: string[]): Term {
  const atoms = terms.map((t) => TermBuilder.atom(t));
  return TermBuilder.conjunction(...atoms);
}

/**
 * Creates a negation term
 */
export function negation(term: Term | string): Term {
  if (typeof term === 'string') {
    return TermBuilder.negation(TermBuilder.atom(term));
  }
  return TermBuilder.negation(term);
}

// ============================================================================
// Truth Value Helpers
// ============================================================================

/**
 * Creates a truth value with validation
 */
export function truth(f: number, c: number): TruthType {
  return Truth.create(f, c);
}

/**
 * Creates a high-confidence truth value
 */
export function highTruth(frequency = 0.9): TruthType {
  return Truth.create(frequency, 0.95);
}

/**
 * Creates a low-confidence truth value
 */
export function lowTruth(frequency = 0.3): TruthType {
  return Truth.create(frequency, 0.4);
}

/**
 * Creates a neutral truth value
 */
export function neutralTruth(): TruthType {
  return Truth.NEUTRAL;
}

// ============================================================================
// Budget Helpers
// ============================================================================

/**
 * Creates a budget with defaults
 */
export function budget(
  priority = 0.8,
  durability = 0.7,
  quality = 0.85
): Budget {
  return createBudget(priority, durability, quality);
}

/**
 * Creates a high-priority budget
 */
export function highPriorityBudget(): Budget {
  return createBudget(0.95, 0.9, 0.9);
}

/**
 * Creates a low-priority budget
 */
export function lowPriorityBudget(): Budget {
  return createBudget(0.3, 0.4, 0.5);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a value is within a range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  const msg = message || `Expected ${value} to be between ${min} and ${max}`;
  if (value < min || value > max) {
    throw new Error(msg);
  }
}

/**
 * Asserts that a value is close to expected (within tolerance)
 */
export function assertCloseTo(
  value: number,
  expected: number,
  tolerance = 0.01,
  message?: string
): void {
  const msg = message || `Expected ${value} to be close to ${expected} (±${tolerance})`;
  if (Math.abs(value - expected) > tolerance) {
    throw new Error(msg);
  }
}

/**
 * Asserts truth value properties
 */
export function assertTruth(
  truth: TruthType,
  options: {
    minF?: number;
    maxF?: number;
    minC?: number;
    maxC?: number;
    exactF?: number;
    exactC?: number;
  }
): void {
  const {minF, maxF, minC, maxC, exactF, exactC} = options;

  if (exactF !== undefined && truth.f !== exactF) {
    throw new Error(`Expected frequency ${truth.f} to equal ${exactF}`);
  }
  if (exactC !== undefined && truth.c !== exactC) {
    throw new Error(`Expected confidence ${truth.c} to equal ${exactC}`);
  }
  if (minF !== undefined && truth.f < minF) {
    throw new Error(`Frequency ${truth.f} below minimum ${minF}`);
  }
  if (maxF !== undefined && truth.f > maxF) {
    throw new Error(`Frequency ${truth.f} above maximum ${maxF}`);
  }
  if (minC !== undefined && truth.c < minC) {
    throw new Error(`Confidence ${truth.c} below minimum ${minC}`);
  }
  if (maxC !== undefined && truth.c > maxC) {
    throw new Error(`Confidence ${truth.c} above maximum ${maxC}`);
  }
}

// ============================================================================
// Test Data Builders
// ============================================================================

/**
 * Builder pattern for creating complex test scenarios
 */
export class TestScenarioBuilder {
  private premises: Task[] = [];
  private config: Record<string, unknown> = {};

  /**
   * Add a belief premise
   */
  belief(term: string | Term, options?: {frequency?: number; confidence?: number}): this {
    this.premises.push(createBelief(term, options));
    return this;
  }

  /**
   * Add a goal premise
   */
  goal(term: string | Term, options?: {priority?: number}): this {
    this.premises.push(createGoal(term, options));
    return this;
  }

  /**
   * Add a question premise
   */
  question(term: string | Term): this {
    this.premises.push(createQuestion(term));
    return this;
  }

  /**
   * Add custom configuration
   */
  configure(key: string, value: unknown): this {
    this.config[key] = value;
    return this;
  }

  /**
   * Build the scenario
   */
  build(): {premises: Task[]; config: Record<string, unknown>} {
    return {
      premises: this.premises,
      config: this.config
    };
  }
}

/**
 * Creates a new test scenario builder
 */
export function scenario(): TestScenarioBuilder {
  return new TestScenarioBuilder();
}

// ============================================================================
// Performance Testing Helpers
// ============================================================================

/**
 * Measures execution time of a function
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{result: T; duration: number}> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return {result, duration};
}

/**
 * Asserts that a function completes within a time limit
 */
export async function assertCompletesWithin(
  fn: () => Promise<void>,
  maxMs: number,
  message?: string
): Promise<void> {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;

  if (duration > maxMs) {
    throw new Error(message || `Operation took ${duration}ms, expected < ${maxMs}ms`);
  }
}

// ============================================================================
// Collection Helpers
// ============================================================================

/**
 * Creates a range of numbers for parameterized tests
 */
export function range(start: number, end: number): number[] {
  return Array.from({length: end - start}, (_, i) => start + i);
}

/**
 * Creates combinations of values for exhaustive testing
 */
export function combinations<T>(values: T[][]): T[][] {
  if (values.length === 0) return [[]];

  const [first, ...rest] = values;
  const restCombinations = combinations(rest);

  return first.flatMap((value) => restCombinations.map((combination) => [value, ...combination]));
}

/**
 * Creates a matrix of test cases from arrays
 */
export function matrix<T extends unknown[]>(...arrays: T[]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0].map((item) => [item] as T);

  const [first, ...rest] = arrays;
  const restMatrix = matrix(...rest);

  return first.flatMap((item) => restMatrix.map((row) => [item, ...row] as T));
}
