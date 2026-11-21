/**
 * Successor — successor function for the task economy.
 *
 * Generates possible successor states from executing a task.
 */

import type { EconomyTask, Successor, TaskBagKind, TaskSource } from './types.js';
import type { Term } from '../kernel/terms/term.js';
import type { Truth } from '../kernel/truth.js';
import { termFactory, TermOp } from '../kernel/terms/term.js';
import { TaskType } from '../kernel/types.js';
import type { Clock, TimestampMs } from '../kernel/env.js';
import { createDefaultClock } from '../kernel/env.js';

/** Successor generation context. */
export interface SuccessorContext {
  /** Current tasks. */
  tasks: EconomyTask[];
  /** Task to generate successors for. */
  task: EconomyTask;
  /** Available oracles. */
  oracleOperations: string[];
  /** Available faculties. */
  facultyNames: string[];
  /** Current iteration. */
  iteration: number;
}

/** Generated successor. */
export interface GeneratedSuccessor extends Successor {
  /** Source operation. */
  source: 'oracle' | 'faculty' | 'derivation' | 'internal';
  /** Operation name. */
  operation: string;
  /** Arguments. */
  args: Record<string, unknown>;
}

/**
 * Generate successors for a task.
 */
export function generateSuccessors(context: SuccessorContext, clock?: Clock): GeneratedSuccessor[] {
  const { task, tasks, oracleOperations, facultyNames, iteration } = context;
  const successors: GeneratedSuccessor[] = [];

  // Generate based on task kind
  switch (task.kind) {
    case 'goal':
      successors.push(...generateGoalSuccessors(task, tasks, oracleOperations, facultyNames, clock));
      break;
    case 'belief':
      successors.push(...generateBeliefSuccessors(task, tasks, iteration, clock));
      break;
    case 'skill':
      successors.push(...generateSkillSuccessors(task, tasks, facultyNames, clock));
      break;
    case 'faculty':
      successors.push(...generateFacultySuccessors(task, tasks, facultyNames, clock));
      break;
    case 'rule':
      successors.push(...generateRuleSuccessors(task, tasks, clock));
      break;
    case 'plan':
      successors.push(...generatePlanSuccessors(task, tasks, oracleOperations, facultyNames, clock));
      break;
  }

  // Always add internal successor (no-op / maintenance)
  successors.push({
    tasks: [task],
    probability: 0.1,
    utilityDelta: 0,
    source: 'internal',
    operation: 'maintain',
    args: {},
  });

  // Normalize probabilities
  const totalProb = successors.reduce((sum, s) => sum + s.probability, 0);
  if (totalProb > 0) {
    for (const s of successors) {
      s.probability /= totalProb;
    }
  }

  return successors;
}

/** Generate successors for goal tasks. */
function generateGoalSuccessors(
  task: EconomyTask,
  _tasks: EconomyTask[],
  oracleOperations: string[],
  facultyNames: string[]
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Oracle-based achievement
  for (const op of oracleOperations) {
    if (op.includes('achieve') || op.includes('execute') || op.includes('solve')) {
      successors.push({
        tasks: [
          createTask(task.id + '-achieved', task.term, 'belief', task.truth, task.weight * 1.2, task.source),
        ],
        probability: 0.3 / oracleOperations.length,
        utilityDelta: task.weight * 0.5,
        source: 'oracle',
        operation: op,
        args: { goal: task.term.toString() },
      });
    }
  }

  // Faculty-based achievement
  for (const faculty of facultyNames) {
    if (faculty.includes('planner') || faculty.includes('actor')) {
      successors.push({
        tasks: [
          createTask(task.id + '-step', task.term, 'plan', { f: 0.5, c: 0.7 }, task.weight, 'oracle'),
        ],
        probability: 0.2 / facultyNames.length,
        utilityDelta: task.weight * 0.3,
        source: 'oracle',
        operation: faculty,
        args: { goal: task.term.toString() },
      });
    }
  }

  // Decomposition into sub-goals
  const subGoals = decomposeGoal(task.term);
  if (subGoals.length > 0) {
    successors.push({
      tasks: subGoals.map((sg, i) =>
        createTask(`${task.id}-sub${i}`, sg, 'goal', { f: 0.6, c: 0.8 }, task.weight / subGoals.length, 'derivation')
      ),
      probability: 0.25,
      utilityDelta: task.weight * 0.2,
      source: 'derivation',
      operation: 'decompose',
      args: { goal: task.term.toString() },
    });
  }

  return successors;
}

/** Generate successors for belief tasks. */
function generateBeliefSuccessors(
  task: EconomyTask,
  tasks: EconomyTask[],
  iteration: number
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Belief revision (strengthening)
  if (task.truth.c < 0.9) {
    successors.push({
      tasks: [
        createTask(task.id + '-revised', task.term, 'belief', { f: task.truth.f, c: Math.min(1, task.truth.c + 0.1) }, task.weight * 1.1, 'derivation'),
      ],
      probability: 0.3,
      utilityDelta: task.weight * 0.1,
      source: 'derivation',
      operation: 'revise',
      args: { belief: task.term.toString() },
    });
  }

  // Belief propagation to related beliefs
  const related = findRelatedBeliefs(task, tasks);
  if (related.length > 0) {
    successors.push({
      tasks: related.map((r, i) =>
        createTask(`${task.id}-prop${i}`, r.term, 'belief', { f: r.truth.f, c: Math.min(1, r.truth.c + 0.05) }, r.weight * 1.05, 'derivation')
      ),
      probability: 0.2,
      utilityDelta: related.reduce((sum, r) => sum + r.weight * 0.05, 0),
      source: 'derivation',
      operation: 'propagate',
      args: { source: task.term.toString() },
    });
  }

  // Contradiction detection
  const contradictions = findContradictions(task, tasks);
  if (contradictions.length > 0) {
    successors.push({
      tasks: contradictions.map((c, i) =>
        createTask(`${task.id}-contra${i}`, c.term, 'goal', { f: 0.8, c: 0.9 }, c.weight * 1.5, 'repair')
      ),
      probability: 0.15,
      utilityDelta: -task.weight * 0.3, // Negative: contradiction is bad
      source: 'derivation',
      operation: 'detect_contradiction',
      args: { belief: task.term.toString() },
    });
  }

  return successors;
}

/** Generate successors for skill tasks. */
function generateSkillSuccessors(
  task: EconomyTask,
  _tasks: EconomyTask[],
  facultyNames: string[]
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Skill execution via faculty
  for (const faculty of facultyNames) {
    if (faculty.includes('skill') || faculty.includes('executor')) {
      successors.push({
        tasks: [
          createTask(task.id + '-executed', task.term, 'belief', { f: 0.9, c: 0.85 }, task.weight * 1.3, 'oracle'),
        ],
        probability: 0.4 / Math.max(1, facultyNames.filter(f => f.includes('skill') || f.includes('executor')).length),
        utilityDelta: task.weight * 0.4,
        source: 'oracle',
        operation: faculty,
        args: { skill: task.term.toString() },
      });
    }
  }

  // Skill improvement (practice)
  successors.push({
    tasks: [
      createTask(task.id + '-improved', task.term, 'skill', { f: Math.min(1, task.truth.f + 0.05), c: task.truth.c }, task.weight * 1.1, 'derivation'),
    ],
    probability: 0.2,
    utilityDelta: task.weight * 0.15,
    source: 'derivation',
    operation: 'practice',
    args: { skill: task.term.toString() },
  });

  return successors;
}

/** Generate successors for faculty tasks. */
function generateFacultySuccessors(
  task: EconomyTask,
  _tasks: EconomyTask[],
  facultyNames: string[]
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Faculty invocation
  for (const faculty of facultyNames) {
    const resultTerm = termFactory.compound(
      TermOp.PRODUCT,
      termFactory.constant('faculty_result'),
      termFactory.constant(faculty),
      task.term
    );
    successors.push({
      tasks: [
        createTask(task.id + '-result', resultTerm, 'belief', { f: 0.7, c: 0.8 }, task.weight, 'oracle'),
      ],
      probability: 0.3 / facultyNames.length,
      utilityDelta: task.weight * 0.2,
      source: 'oracle',
      operation: faculty,
      args: { input: task.term.toString() },
    });
  }

  return successors;
}

/** Generate successors for rule tasks. */
function generateRuleSuccessors(
  task: EconomyTask,
  tasks: EconomyTask[]
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Rule application (forward chaining)
  const applicable = findApplicableRules(task, tasks);
  if (applicable.length > 0) {
    successors.push({
      tasks: applicable.map((a, i) =>
        createTask(`${task.id}-apply${i}`, a.conclusion, 'belief', a.truth, task.weight * 0.9, 'derivation')
      ),
      probability: 0.3,
      utilityDelta: applicable.reduce((sum, a) => sum + a.truth.c * task.weight * 0.1, 0),
      source: 'derivation',
      operation: 'apply_rule',
      args: { rule: task.term.toString() },
    });
  }

  return successors;
}

/** Generate successors for plan tasks. */
function generatePlanSuccessors(
  task: EconomyTask,
  tasks: EconomyTask[],
  oracleOperations: string[],
  facultyNames: string[]
, clock?: Clock): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Plan execution steps
  const steps = extractPlanSteps(task.term);
  for (const step of steps) {
    // Try oracle first
    for (const op of oracleOperations) {
      if (op.includes(step.action)) {
        successors.push({
          tasks: [
            createTask(`${task.id}-${step.action}`, step.term, 'goal', { f: 0.6, c: 0.7 }, task.weight / steps.length, 'oracle'),
          ],
          probability: 0.4 / (steps.length * oracleOperations.length),
          utilityDelta: task.weight * 0.3 / steps.length,
          source: 'oracle',
          operation: op,
          args: step.args,
        });
      }
    }

    // Then faculty
    for (const faculty of facultyNames) {
      if (faculty.includes(step.action)) {
        successors.push({
          tasks: [
            createTask(`${task.id}-${step.action}`, step.term, 'goal', { f: 0.6, c: 0.7 }, task.weight / steps.length, 'oracle'),
          ],
          probability: 0.3 / (steps.length * facultyNames.length),
          utilityDelta: task.weight * 0.25 / steps.length,
          source: 'oracle',
          operation: faculty,
          args: step.args,
        });
      }
    }
  }

  return successors;
}

/** Create a task factory bound to a clock (one timestamp per successor batch). */
function createTaskFactory(clock?: Clock): (
  id: string,
  term: Term,
  kind: TaskBagKind,
  truth: Truth,
  weight: number,
  source: TaskSource
) => EconomyTask {
  const ts: TimestampMs = (clock ?? createDefaultClock()).now();
  return (id, term, kind, truth, weight, source) => ({
    id,
    term,
    kind,
    truth,
    weight,
    activation: 0.5,
    source,
    createdAt: ts,
    lastAccessed: ts,
    accessCount: 0,
    dependencies: [],
    derived: true,
    tags: [],
    type: TaskType.GOAL,
    priority: weight,
    stamp: undefined,
  });
}

/** Decompose a goal term into sub-goals. */
function decomposeGoal(term: Term): Term[] {
  // Simplified: extract conjuncts if it's a conjunction
  const str = term.toString();
  if (str.includes('&') || str.includes('∧')) {
    return str.split(/[&∧]/).map(s => ({ toString: () => s.trim() } as Term));
  }
  return [];
}

/** Find beliefs related to a task. */
function findRelatedBeliefs(task: EconomyTask, tasks: EconomyTask[]): EconomyTask[] {
  const taskStr = task.term.toString();
  return tasks
    .filter(t => t.kind === 'belief' && t.id !== task.id)
    .filter(t => {
      const tStr = t.term.toString();
      return tStr.includes(taskStr) || taskStr.includes(tStr) || jaccardSimilarity(tStr, taskStr) > 0.3;
    })
    .slice(0, 5);
}

/** Find contradictions for a belief. */
function findContradictions(task: EconomyTask, tasks: EconomyTask[]): EconomyTask[] {
  const taskStr = task.term.toString();
  const negated = taskStr.startsWith('~') ? taskStr.slice(1) : `~${taskStr}`;

  return tasks
    .filter(t => t.kind === 'belief' && t.term.toString() === negated)
    .slice(0, 3);
}

/** Find applicable rules. */
function findApplicableRules(task: EconomyTask, tasks: EconomyTask[]): Array<{ conclusion: Term; truth: Truth }> {
  // Simplified: look for rules that match the task term
  const results: Array<{ conclusion: Term; truth: Truth }> = [];

  for (const t of tasks) {
    if (t.kind === 'rule') {
      const ruleStr = t.term.toString();
      if (ruleStr.includes(task.term.toString())) {
        // Extract conclusion (simplified)
        results.push({
          conclusion: task.term,
          truth: { f: t.truth.f * 0.9, c: t.truth.c * 0.8 },
        });
      }
    }
  }

  return results.slice(0, 5);
}

/** Extract steps from a plan term. */
function extractPlanSteps(term: Term): Array<{ action: string; term: Term; args: Record<string, unknown> }> {
  const str = term.toString();
  const steps: Array<{ action: string; term: Term; args: Record<string, unknown> }> = [];

  // Look for sequence operators
  if (str.includes(';') || str.includes('→') || str.includes('->')) {
    const parts = str.split(/[;→]|->/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        steps.push({
          action: trimmed.split('(')[0] || 'step',
          term: { toString: () => trimmed } as Term,
          args: {},
        });
      }
    }
  }

  return steps.slice(0, 10);
}

/** Jaccard similarity for strings. */
function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(a.split(/[\s\(\)\[\],]+/));
  const bTokens = new Set(b.split(/[\s\(\)\[\],]+/));
  const intersection = new Set([...aTokens].filter(x => bTokens.has(x)));
  const union = new Set([...aTokens, ...bTokens]);
  return union.size > 0 ? intersection.size / union.size : 0;
}