/**
 * Test Utilities and Helpers
 *
 * Common utilities for test creation, validation, and DRY patterns
 */

import type { Budget, Task, TaskType, Term, Truth as TruthType } from '../../../nar/src';
import {
  Stamp,
  TermBuilder,
  Truth,
  createBudget as createBudgetFn,
  createTask as createTaskFn,
} from '../../../nar/src';

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a test budget with customizable values
 */
export function createTestBudget(params?: Partial<Budget>): Budget {
  return createBudgetFn(
    params?.priority ?? 0.5,
    params?.durability ?? 0.8,
    params?.quality ?? 0.9,
    params?.cycles ?? 0,
    params?.depth ?? 0
  );
}

/**
 * Creates a test term using TermBuilder
 */
export function createTestTerm(symbol = 'test'): Term {
  return TermBuilder.atom(symbol);
}

/**
 * Creates a test truth value
 */
export function createTestTruth(frequency = 0.5, confidence = 0.8): TruthType {
  return Truth.create(frequency, confidence);
}

/**
 * Creates a test task with all required properties
 */
export function createTestTask(params?: {
  term?: Term;
  type?: TaskType;
  truth?: TruthType;
  budget?: Budget;
  derived?: boolean;
}): Task {
  const term = params?.term ?? createTestTerm();
  const type = params?.type ?? 'belief';
  const truth = params?.truth ?? createTestTruth();
  const budget = params?.budget ?? createTestBudget();
  const derived = params?.derived ?? false;

  return createTaskFn(term, type, truth, budget, undefined, derived);
}

/**
 * Creates a test stamp
 */
export function createTestStamp(source = 'INPUT'): ReturnType<typeof Stamp.createInput> {
  return Stamp.createInput();
}

// ============================================================================
// Test Data Builders
// ============================================================================

/**
 * Builder pattern for creating complex test scenarios
 */
export class TaskBuilder {
  private term: Term;
  private type: TaskType;
  private truth: TruthType;
  private budget: Budget;
  private derived: boolean;

  constructor() {
    this.term = createTestTerm();
    this.type = 'belief';
    this.truth = createTestTruth();
    this.budget = createTestBudget();
    this.derived = false;
  }

  withTerm(term: Term): TaskBuilder {
    this.term = term;
    return this;
  }

  withType(type: TaskType): TaskBuilder {
    this.type = type;
    return this;
  }

  withTruth(truth: TruthType): TaskBuilder {
    this.truth = truth;
    return this;
  }

  withBudget(budget: Budget): TaskBuilder {
    this.budget = budget;
    return this;
  }

  withDerived(derived: boolean): TaskBuilder {
    this.derived = derived;
    return this;
  }

  build(): Task {
    return createTestTask({
      term: this.term,
      type: this.type,
      truth: this.truth,
      budget: this.budget,
      derived: this.derived,
    });
  }
}

// ============================================================================
// Parameterized Test Helpers
// ============================================================================

/**
 * Helper type for parameterized test cases
 */
export type TestCase<T> = T & {
  name: string;
};

/**
 * Creates parameterized test cases from an array of test data
 */
export function createTestCases<T extends Record<string, unknown>>(
  cases: Array<TestCase<T>>
): Array<TestCase<T>> {
  return cases;
}

/**
 * Helper for creating budget test cases
 */
export interface BudgetTestCase {
  name: string;
  priority: number;
  durability?: number;
  quality?: number;
  cycles?: number;
  depth?: number;
  expected: Partial<Budget>;
}

/**
 * Helper for creating task test cases
 */
export interface TaskTestCase {
  name: string;
  term: Term;
  type: TaskType;
  truth: TruthType;
  budget?: Budget;
  expected: Partial<Task>;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a budget has expected properties
 */
export function expectBudget(budget: Budget, expected: Partial<Budget>): void {
  if (expected.priority !== undefined) {
    expect(budget.priority).toBeCloseTo(expected.priority);
  }
  if (expected.durability !== undefined) {
    expect(budget.durability).toBeCloseTo(expected.durability);
  }
  if (expected.quality !== undefined) {
    expect(budget.quality).toBeCloseTo(expected.quality);
  }
  if (expected.cycles !== undefined) {
    expect(budget.cycles).toBe(expected.cycles);
  }
  if (expected.depth !== undefined) {
    expect(budget.depth).toBe(expected.depth);
  }
}

/**
 * Validates that a task has expected properties
 */
export function expectTask(task: Task, expected: Partial<Task>): void {
  if (expected.term) {
    expect(task.term).toBe(expected.term);
  }
  if (expected.type) {
    expect(task.type).toBe(expected.type);
  }
  if (expected.truth) {
    expect(task.truth).toBe(expected.truth);
  }
  if (expected.budget) {
    expect(task.budget).toBe(expected.budget);
  }
  if (expected.derived !== undefined) {
    expect(task.derived).toBe(expected.derived);
  }
}

/**
 * Validates truth value properties
 */
export function expectTruth(truth: TruthType, expected: Partial<{ f: number; c: number }>): void {
  if (expected.f !== undefined) {
    expect(truth.f).toBeCloseTo(expected.f);
  }
  if (expected.c !== undefined) {
    expect(truth.c).toBeCloseTo(expected.c);
  }
}

// ============================================================================
// Common Test Data
// ============================================================================

/**
 * Common truth values for testing
 */
export const TruthValues = {
  HIGH: Truth.create(0.9, 0.9),
  MEDIUM: Truth.create(0.5, 0.7),
  LOW: Truth.create(0.2, 0.6),
  NEUTRAL: Truth.NEUTRAL,
  TRUE: Truth.TRUE,
  FALSE: Truth.create(0.0, 0.9),
} as const;

/**
 * Common budget configurations for testing
 */
export const BudgetConfigs = {
  HIGH: createBudgetFn(0.9, 0.9, 0.9, 5, 3),
  MEDIUM: createBudgetFn(0.5, 0.7, 0.8, 3, 2),
  LOW: createBudgetFn(0.2, 0.5, 0.6, 1, 1),
  DEFAULT: createBudgetFn(0.5),
} as const;

/**
 * Common terms for testing
 */
export const TestTerms = {
  BIRD: TermBuilder.atom('bird'),
  ANIMAL: TermBuilder.atom('animal'),
  MAMMAL: TermBuilder.atom('mammal'),
  DOG: TermBuilder.atom('dog'),
  CAT: TermBuilder.atom('cat'),
  FLY: TermBuilder.atom('fly'),
} as const;
