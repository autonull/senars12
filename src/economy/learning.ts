/**
 * Economy Learning — metareasoning, TD learning, and successor functions.
 *
 * Combines metareasoning (think vs act), TD learning (successor features),
 * and successor generation into a single learning module.
 */

import type { EconomyTask, MetareasoningResult, MetareasoningDecision, SchedulerConfig, Successor, TaskBagKind, TaskSource, Overlay } from './types';
import type { Truth } from '../kernel/truth';
import type { Term } from '../kernel/terms/term';
import { termFactory, TermOp } from '../kernel/terms/term';
import { TaskType } from '../kernel/types';
import type { Clock, TimestampMs } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';
import { calculateTaskUtility } from './utility-voi';
import { SenarsError } from '../errors/senars-error';
import { flooredRatio } from '@senars/util/numeric';

// ============================================================================
// Metareasoning
// ============================================================================

/** Metareasoning context. */
export interface MetareasoningContext {
  /** Top candidate. */
  top: EconomyTask;
  /** Second candidate. */
  second?: EconomyTask;
  /** All candidates. */
  candidates: EconomyTask[];
  /** Current iteration. */
  iteration: number;
  /** Budget remaining. */
  budgetRemaining: number;
  /** Time pressure (0-1). */
  timePressure: number;
  /** Current total utility. */
  totalUtility: number;
  /** Successors map. */
  successors: Map<string, Successor[]>;
  /** Scheduler config. */
  config: SchedulerConfig;
}

/**
 * Decide whether to think or act based on judgment margin.
 *
 * If the margin between top and second candidate is small, think (explore).
 * If the margin is large, act (exploit).
 */
export function metareason(context: MetareasoningContext): MetareasoningResult {
  const { top, second, candidates, config, budgetRemaining, timePressure } = context;

  if (!second || candidates.length === 1) {
    return {
      decision: 'act',
      confidence: 0.9,
      reasoning: 'Only one viable candidate',
      budgetAllocated: 0,
    };
  }

  // Calculate utility margin
  const topUtility = calculateTaskUtility(
    top,
    context.successors.get(top.id) ?? [],
    context.totalUtility,
    config,
    config.overlays
  ).total;

  const secondUtility = calculateTaskUtility(
    second,
    context.successors.get(second.id) ?? [],
    context.totalUtility,
    config,
    config.overlays
  ).total;

  const margin = topUtility - secondUtility;

  // Normalize margin by top utility
  const normalizedMargin = topUtility > 0 ? margin / topUtility : 0;

  // Decision logic
  let decision: MetareasoningDecision;
  let confidence: number;
  let reasoning: string;

  if (normalizedMargin < config.marginThreshold) {
    // Small margin: uncertain, should think
    if (budgetRemaining > 10 && timePressure < 0.7) {
      decision = 'think';
      confidence = 0.8;
      reasoning = `Small margin (${normalizedMargin.toFixed(3)} < ${config.marginThreshold}), thinking to reduce uncertainty`;
    } else {
      decision = 'act';
      confidence = 0.6;
      reasoning = `Small margin but budget/time pressure forces action`;
    }
  } else {
    // Large margin: confident, should act
    decision = 'act';
    confidence = Math.min(0.95, 0.5 + normalizedMargin);
    reasoning = `Large margin (${normalizedMargin.toFixed(3)} >= ${config.marginThreshold}), acting confidently`;
  }

  // Consider delegation for complex tasks
  if (decision === 'think' && top.kind === 'plan' && candidates.length > 3) {
    decision = 'delegate';
    confidence = 0.7;
    reasoning = `Complex plan task with alternatives, delegating to sub-economy`;
  }

  // Consider deferring for low-priority maintenance
  if (decision === 'act' && top.kind === 'belief' && top.activation < 0.2 && timePressure > 0.5) {
    decision = 'defer';
    confidence = 0.75;
    reasoning = `Low-activation belief under time pressure, deferring`;
  }

  return {
    decision,
    confidence,
    reasoning,
    budgetAllocated: decision === 'think' ? Math.min(budgetRemaining, 20) : 0,
  };
}

/**
 * Calculate the metareasoning budget allocation.
 */
export function calculateMetareasoningBudget(
  context: MetareasoningContext,
  decision: MetareasoningDecision
): number {
  const { budgetRemaining, config } = context;

  switch (decision) {
    case 'think':
      // Allocate up to 20% of remaining budget for thinking
      return Math.min(budgetRemaining * 0.2, 20);
    case 'delegate':
      // Allocate up to 50% for delegation
      return Math.min(budgetRemaining * 0.5, 50);
    case 'defer':
      // No budget allocated
      return 0;
    case 'act':
    default:
      // Full budget for action
      return budgetRemaining;
  }
}

/**
 * Evaluate the outcome of a metareasoning decision.
 */
export function evaluateMetareasoningOutcome(
  decision: MetareasoningDecision,
  actualUtility: number,
  expectedUtility: number,
  budgetUsed: number
): { score: number; feedback: string } {
  const utilityRatio = expectedUtility > 0 ? actualUtility / expectedUtility : 1;

  let score: number;
  let feedback: string;

  if (decision === 'think') {
    // Thinking is good if it led to better utility than expected
    score = utilityRatio > 1 ? 1.0 : Math.max(0, utilityRatio);
    feedback = utilityRatio > 1
      ? 'Thinking improved outcome beyond expectation'
      : 'Thinking did not yield expected improvement';
  } else if (decision === 'act') {
    // Acting is good if utility meets expectation
    score = utilityRatio > 0.8 ? 1.0 : utilityRatio;
    feedback = utilityRatio > 0.8
      ? 'Action met expectations'
      : 'Action fell short of expectations';
  } else if (decision === 'delegate') {
    // Delegation is good if sub-task succeeded
    score = utilityRatio > 0.7 ? 1.0 : utilityRatio * 0.8;
    feedback = utilityRatio > 0.7
      ? 'Delegation succeeded'
      : 'Delegation partially succeeded';
  } else { // defer
    // Deferring is neutral unless it caused missed opportunity
    score = 0.5;
    feedback = 'Task deferred';
  }

  return { score, feedback };
}

// ============================================================================
// Successor Generation
// ============================================================================

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
  facultyNames: string[],
  clock?: Clock
): GeneratedSuccessor[] {
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
  iteration: number,
  clock?: Clock
): GeneratedSuccessor[] {
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
  facultyNames: string[],
  clock?: Clock
): GeneratedSuccessor[] {
  const successors: GeneratedSuccessor[] = [];
  const createTask = createTaskFactory(clock);

  // Skill execution via faculty
  for (const faculty of facultyNames) {
    if (faculty.includes('skill') || faculty.includes('executor')) {
      successors.push({
        tasks: [
          createTask(task.id + '-executed', task.term, 'belief', { f: 0.9, c: 0.85 }, task.weight * 1.3, 'oracle'),
        ],
        probability: 0.4 * flooredRatio(1, facultyNames.filter(f => f.includes('skill') || f.includes('executor')).length),
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
  facultyNames: string[],
  clock?: Clock
): GeneratedSuccessor[] {
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
  tasks: EconomyTask[],
  clock?: Clock
): GeneratedSuccessor[] {
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
  facultyNames: string[],
  clock?: Clock
): GeneratedSuccessor[] {
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

// ============================================================================
// TD Learning — Successor Feature Learning
// ============================================================================

/** Transition recorded in the log. */
export interface LoggedTransition {
  /** From state (task). */
  from: EconomyTask;
  /** Action taken. */
  action: string;
  /** To state (tasks). */
  to: EconomyTask[];
  /** Reward (utility delta). */
  reward: number;
  /** Iteration. */
  iteration: number;
  /** Timestamp. */
  timestamp: number;
}

/** Successor feature vector. */
export interface SuccessorFeatures {
  /** Task ID. */
  taskId: string;
  /** Feature vector (one per feature dimension). */
  features: number[];
  /** Feature names. */
  featureNames: string[];
  /** Discount factor. */
  gamma: number;
}

/** Learned value weights. */
export interface ValueWeights {
  /** Weight per feature. */
  weights: number[];
  /** Feature names. */
  featureNames: string[];
  /** Last updated. */
  updatedAt: number;
  /** Sample count. */
  samples: number;
}

/** TD learning configuration. */
export interface TDLearningConfig {
  /** Discount factor. */
  gamma: number;
  /** Learning rate. */
  alpha: number;
  /** Feature dimensions. */
  featureDimensions: string[];
  /** Max history size. */
  maxHistory: number;
}

/** Default TD learning config. */
export const defaultTDConfig: TDLearningConfig = {
  gamma: 0.95,
  alpha: 0.1,
  featureDimensions: [
    'kind_belief',
    'kind_goal',
    'kind_skill',
    'kind_faculty',
    'kind_rule',
    'kind_plan',
    'truth_frequency',
    'truth_confidence',
    'activation',
    'weight',
    'access_count',
    'age_hours',
  ],
  maxHistory: 10000,
};

/** Extract feature vector from a task. */
export function extractFeatures(task: EconomyTask, featureNames: string[]): number[] {
  const features: number[] = [];

  for (const name of featureNames) {
    switch (name) {
      case 'kind_belief':
        features.push(task.kind === 'belief' ? 1 : 0);
        break;
      case 'kind_goal':
        features.push(task.kind === 'goal' ? 1 : 0);
        break;
      case 'kind_skill':
        features.push(task.kind === 'skill' ? 1 : 0);
        break;
      case 'kind_faculty':
        features.push(task.kind === 'faculty' ? 1 : 0);
        break;
      case 'kind_rule':
        features.push(task.kind === 'rule' ? 1 : 0);
        break;
      case 'kind_plan':
        features.push(task.kind === 'plan' ? 1 : 0);
        break;
      case 'truth_frequency':
        features.push(task.truth.f);
        break;
      case 'truth_confidence':
        features.push(task.truth.c);
        break;
      case 'activation':
        features.push(task.activation);
        break;
      case 'weight':
        features.push(Math.min(1, task.weight / 10)); // Normalize
        break;
      case 'access_count':
        features.push(Math.min(1, task.accessCount / 100));
        break;
      case 'age_hours': {
        const ageHours = (Date.now() - task.createdAt) / (1000 * 60 * 60);
        features.push(Math.min(1, ageHours / 168)); // Normalize to week
        break;
      }
      default:
        features.push(0);
    }
  }

  return features;
}

/** Compute successor features for a task using logged transitions. */
export function computeSuccessorFeatures(
  task: EconomyTask,
  transitions: LoggedTransition[],
  config: TDLearningConfig = defaultTDConfig
): SuccessorFeatures {
  const { gamma, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  // Initialize successor feature vector
  let psi: number[] = new Array(featureDim).fill(0);
  let count = 0;

  // Find transitions from this task
  const relevantTransitions = transitions.filter(t => t.from.id === task.id);

  for (const trans of relevantTransitions) {
    // Average features of successor states
    let succFeatures: number[] = new Array(featureDim).fill(0);
    for (const succTask of trans.to) {
      const f = extractFeatures(succTask, featureNames);
      for (let i = 0; i < featureDim; i++) {
        succFeatures[i]! += f[i]!;
      }
    }

    // Average over successors
    if (trans.to.length > 0) {
      for (let i = 0; i < featureDim; i++) {
        succFeatures[i]! /= trans.to.length;
      }
    }

    // Add immediate features + discounted successor features
    const immediateFeatures = extractFeatures(task, featureNames);
    for (let i = 0; i < featureDim; i++) {
      psi[i]! += immediateFeatures[i]! + gamma * succFeatures[i]!;
    }
    count++;
  }

  // Average over transitions
  if (count > 0) {
    for (let i = 0; i < featureDim; i++) {
      psi[i]! /= count;
    }
  } else {
    // No transitions: use immediate features only
    psi = extractFeatures(task, featureNames);
  }

  return {
    taskId: task.id,
    features: psi,
    featureNames,
    gamma,
  };
}

/** Learn value weights from transitions (TD(0)). */
export function learnValueWeights(
  transitions: LoggedTransition[],
  config: TDLearningConfig = defaultTDConfig,
  initialWeights?: ValueWeights
): ValueWeights {
  const { gamma, alpha, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  let weights: number[] = initialWeights?.weights ?? new Array(featureDim).fill(0);
  let samples = initialWeights?.samples ?? 0;

  for (const trans of transitions) {
    const fromFeatures = extractFeatures(trans.from, featureNames);

    // Compute target: reward + gamma * V(next_state)
    // Average V over all successor states
    let nextValue = 0;
    for (const succ of trans.to) {
      const succFeatures = extractFeatures(succ, featureNames);
      let v = 0;
      for (let i = 0; i < featureDim; i++) {
        v += weights[i]! * succFeatures[i]!;
      }
      nextValue += v;
    }
    if (trans.to.length > 0) {
      nextValue /= trans.to.length;
    }

    const target = trans.reward + gamma * nextValue;
    const currentValue = weights.reduce((sum, w, i) => sum + w * fromFeatures[i]!, 0);
    const tdError = target - currentValue;

    // Update weights
    for (let i = 0; i < featureDim; i++) {
      weights[i]! += alpha * tdError * fromFeatures[i]!;
    }
    samples++;
  }

  return {
    weights,
    featureNames,
    updatedAt: Date.now(),
    samples,
  };
}

/** Predict value of a task using learned weights. */
export function predictValue(
  task: EconomyTask,
  valueWeights: ValueWeights,
  config: TDLearningConfig = defaultTDConfig
): number {
  const features = extractFeatures(task, valueWeights.featureNames);
  let value = 0;
  const weights = valueWeights.weights;
  for (let i = 0; i < features.length; i++) {
    value += weights[i]! * features[i]!;
  }
  return value;
}

/** Predict value from successor features. */
export function predictValueFromSF(
  sf: SuccessorFeatures,
  valueWeights: ValueWeights
): number {
  let value = 0;
  const weights = valueWeights.weights;
  for (let i = 0; i < sf.features.length; i++) {
    value += weights[i]! * sf.features[i]!;
  }
  return value;
}

/** Learn from a single transition (online TD). */
export function tdStep(
  from: EconomyTask,
  to: EconomyTask[],
  reward: number,
  valueWeights: ValueWeights,
  config: TDLearningConfig = defaultTDConfig
): ValueWeights {
  const { gamma, alpha, featureDimensions } = config;
  const featureNames = featureDimensions;
  const featureDim = featureNames.length;

  const fromFeatures = extractFeatures(from, featureNames);

  // Compute target
  let nextValue = 0;
  for (const succ of to) {
    const succFeatures = extractFeatures(succ, featureNames);
    let v = 0;
    const weights = valueWeights.weights;
    for (let i = 0; i < featureDim; i++) {
      v += weights[i]! * succFeatures[i]!;
    }
    nextValue += v;
  }
  if (to.length > 0) {
    nextValue /= to.length;
  }

  const target = reward + gamma * nextValue;
  const currentValue = valueWeights.weights.reduce((sum, w, i) => sum + w * fromFeatures[i]!, 0);
  const tdError = target - currentValue;

  // Update weights
  const newWeights = [...valueWeights.weights];
  for (let i = 0; i < featureDim; i++) {
    newWeights[i]! += alpha * tdError * fromFeatures[i]!;
  }

  return {
    weights: newWeights,
    featureNames,
    updatedAt: Date.now(),
    samples: valueWeights.samples + 1,
  };
}

/** Convert successor features to Successor format for scheduler. */
export function successorFeaturesToSuccessors(
  sf: SuccessorFeatures,
  valueWeights: ValueWeights
): Successor[] {
  const value = predictValueFromSF(sf, valueWeights);
  return [{
    tasks: [], // Would need to reconstruct tasks
    probability: 1.0,
    utilityDelta: value,
  }];
}

/** Merge multiple successor feature estimates (e.g., from different log segments). */
export function mergeSuccessorFeatures(
  features: SuccessorFeatures[],
  weights?: number[]
): SuccessorFeatures {
  if (features.length === 0) {
    throw new SenarsError('No features to merge', 'OPERATION_ERROR');
  }

  const featureDim = features[0]!.features.length;
  const merged: number[] = new Array(featureDim).fill(0);
  const w = weights ?? new Array(features.length).fill(1 / features.length);

  for (let i = 0; i < features.length; i++) {
    for (let j = 0; j < featureDim; j++) {
      merged[j]! += w[i]! * features[i]!.features[j]!;
    }
  }

  return {
    taskId: features[0]!.taskId,
    featureNames: features[0]!.featureNames,
    gamma: features[0]!.gamma,
    features: merged,
  };
}