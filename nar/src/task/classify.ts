import type { Task } from '../types';
import type { Term } from '../terms';
import {
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  isAtomic,
  isCompound,
  operationNameOf,
} from '../terms';

/** Typed semantic signals emitted by task classification. */
export type TaskSignal =
  | 'test-passed'
  | 'test-failed'
  | 'contradiction'
  | 'schema-promoted'
  | 'capability-added'
  | 'goal-achieved'
  | 'goal-failed';

/**
 * Classify a task into typed semantic signals based on its term structure.
 * Replaces substring sniffing with structural term analysis.
 */
export function classifyTask(term: Term): TaskSignal[] {
  const signals: TaskSignal[] = [];

  // A tool goal is an operation, and its name says whether the call achieved or
  // failed. Read here, at the term, rather than by sniffing an atom's sigil.
  const operation = operationNameOf(term);
  if (operation !== undefined) {
    if (operation.includes('achieved') || operation.includes('success')) {
      signals.push('goal-achieved');
    } else if (operation.includes('failed') || operation.includes('error')) {
      signals.push('goal-failed');
    }
    return signals;
  }

  if (isAtomic(term)) {
    const symbol = term.symbol;
    if (symbol === 'test_passed' || symbol === 'test.passed') {
      signals.push('test-passed');
    } else if (symbol === 'test_failed' || symbol === 'test.failed') {
      signals.push('test-failed');
    } else if (symbol === 'contradiction' || symbol === 'conflict') {
      signals.push('contradiction');
    } else if (symbol === 'schema_promoted' || symbol === 'schema.promoted') {
      signals.push('schema-promoted');
    } else if (symbol === 'capability_added' || symbol === 'capability.added') {
      signals.push('capability-added');
    }
    return signals;
  }

  if (isCompound(term)) {
    const args = getArgs(term);
    const predicate = getPredicate(term);

    // Check for contradiction in inheritance statements
    if (term.kind === 'inheritance' && predicate) {
      const predSymbol = isAtomic(predicate) ? predicate.symbol : '';
      if (predSymbol === 'contradiction' || predSymbol === 'conflict') {
        signals.push('contradiction');
      }
    }

    // Check for test result in compound terms
    if (args) {
      for (const arg of args) {
        signals.push(...classifyTask(arg));
      }
    }

    // Check for schema promotion pattern: (X --> schema_promoted)
    if (term.kind === 'inheritance') {
      const subject = getSubject(term);
      if (
        subject &&
        isAtomic(subject) &&
        (subject.symbol === 'schema_promoted' || subject.symbol === 'schema.promoted')
      ) {
        signals.push('schema-promoted');
      }
    }

    // Check for capability addition pattern
    if (term.kind === 'inheritance') {
      const subject = getSubject(term);
      if (
        subject &&
        isAtomic(subject) &&
        (subject.symbol === 'capability_added' || subject.symbol === 'capability.added')
      ) {
        signals.push('capability-added');
      }
    }

    // Check for goal achievement/failure in implications (predictive or retrospective)
    if (
      term.kind === 'implication' ||
      term.kind === 'predictive' ||
      term.kind === 'retrospective'
    ) {
      const consequent = getConsequent(term);
      if (consequent && isAtomic(consequent)) {
        if (consequent.symbol.includes('achieved') || consequent.symbol.includes('success')) {
          signals.push('goal-achieved');
        } else if (consequent.symbol.includes('failed') || consequent.symbol.includes('error')) {
          signals.push('goal-failed');
        }
      }
    }
  }

  return signals;
}

/**
 * Convenience function to classify a full Task.
 */
export function classifyTaskSignals(task: Task): TaskSignal[] {
  return classifyTask(task.term);
}
