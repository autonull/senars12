/**
 * Value of Information (VoI) — quantifies the value of reducing uncertainty.
 *
 * VoI measures how much a task contributes to reducing uncertainty about goals
 * and updating beliefs.
 */

import type { EconomyTask, TaskVoI, TaskBagKind } from './types.js';
import type { Term } from '../kernel/terms/term.js';

/** VoI calculation context. */
export interface VoIContext {
  /** Task to evaluate. */
  task: EconomyTask;
  /** Current goals. */
  goals: EconomyTask[];
  /** Current beliefs. */
  beliefs: EconomyTask[];
  /** Current skills. */
  skills: EconomyTask[];
  /** Available oracles. */
  oracleCapabilities: string[];
  /** Available faculties. */
  facultyCapabilities: string[];
  /** Iteration number. */
  iteration: number;
}

/** VoI components breakdown. */
export interface VoIBreakdown {
  /** Goal uncertainty reduction. */
  goalUncertaintyReduction: number;
  /** Belief update potential. */
  beliefUpdatePotential: number;
  /** Skill acquisition value. */
  skillAcquisitionValue: number;
  /** Oracle information gain. */
  oracleInformationGain: number;
  /** Faculty information gain. */
  facultyInformationGain: number;
  /** Exploration bonus. */
  explorationBonus: number;
  /** Total VoI. */
  total: number;
}

/**
 * Calculate detailed VoI for a task.
 */
export function calculateDetailedVoI(context: VoIContext): VoIBreakdown {
  const { task, goals, beliefs, skills, oracleCapabilities, facultyCapabilities, iteration } = context;

  // 1. Goal uncertainty reduction
  const goalUncertaintyReduction = calculateGoalUncertaintyReduction(task, goals);

  // 2. Belief update potential
  const beliefUpdatePotential = calculateBeliefUpdatePotential(task, beliefs);

  // 3. Skill acquisition value
  const skillAcquisitionValue = calculateSkillAcquisitionValue(task, skills);

  // 4. Oracle information gain
  const oracleInformationGain = calculateOracleInformationGain(task, oracleCapabilities);

  // 5. Faculty information gain
  const facultyInformationGain = calculateFacultyInformationGain(task, facultyCapabilities);

  // 6. Exploration bonus (decays over time)
  const explorationBonus = calculateExplorationBonus(task, iteration);

  // Weighted combination
  const weights = {
    goal: 0.3,
    belief: 0.2,
    skill: 0.15,
    oracle: 0.15,
    faculty: 0.1,
    exploration: 0.1,
  };

  const total =
    weights.goal * goalUncertaintyReduction +
    weights.belief * beliefUpdatePotential +
    weights.skill * skillAcquisitionValue +
    weights.oracle * oracleInformationGain +
    weights.faculty * facultyInformationGain +
    weights.exploration * explorationBonus;

  return {
    goalUncertaintyReduction,
    beliefUpdatePotential,
    skillAcquisitionValue,
    oracleInformationGain,
    facultyInformationGain,
    explorationBonus,
    total: Math.min(1, total),
  };
}

/** Calculate goal uncertainty reduction. */
function calculateGoalUncertaintyReduction(task: EconomyTask, goals: EconomyTask[]): number {
  if (goals.length === 0) return 0;

  let totalReduction = 0;
  for (const goal of goals) {
    const alignment = taskAlignment(task, goal);
    const uncertainty = 1 - goal.truth.c;
    totalReduction += alignment * uncertainty;
  }

  return Math.min(1, totalReduction / goals.length);
}

/** Calculate belief update potential. */
function calculateBeliefUpdatePotential(task: EconomyTask, beliefs: EconomyTask[]): number {
  if (beliefs.length === 0) return 0;

  let totalPotential = 0;
  for (const belief of beliefs) {
    const relevance = taskRelevance(task, belief);
    const surprise = calculateSurprise(task, belief);
    totalPotential += relevance * surprise;
  }

  return Math.min(1, totalPotential / beliefs.length);
}

/** Calculate skill acquisition value. */
function calculateSkillAcquisitionValue(task: EconomyTask, skills: EconomyTask[]): number {
  if (task.kind !== 'skill' && task.kind !== 'goal') return 0;

  // Value of acquiring a new skill
  if (task.kind === 'skill') {
    const existing = skills.find(s => s.term.toString() === task.term.toString());
    if (!existing) return 0.8; // New skill
    if (existing.truth.c < 0.7) return 0.5; // Improving existing
    return 0.1; // Already proficient
  }

  // Goal that enables skill learning
  if (task.kind === 'goal') {
    const enablesSkill = skills.some(s => taskAlignment(task, s) > 0.5);
    return enablesSkill ? 0.4 : 0;
  }

  return 0;
}

/** Calculate oracle information gain. */
function calculateOracleInformationGain(task: EconomyTask, oracleCapabilities: string[]): number {
  if (oracleCapabilities.length === 0) return 0;

  // Tasks that can be resolved by oracles have higher VoI
  const taskStr = task.term.toString();
  let matches = 0;

  for (const cap of oracleCapabilities) {
    const taskPrefix = taskStr.split('(')[0] ?? taskStr;
    if (taskStr.includes(cap) || cap.includes(taskPrefix)) {
      matches++;
    }
  }

  return Math.min(1, matches / Math.max(1, oracleCapabilities.length)) * 0.5;
}

/** Calculate faculty information gain. */
function calculateFacultyInformationGain(task: EconomyTask, facultyCapabilities: string[]): number {
  if (facultyCapabilities.length === 0) return 0;

  const taskStr = task.term.toString();
  let matches = 0;

  for (const cap of facultyCapabilities) {
    const taskPrefix = taskStr.split('(')[0] ?? taskStr;
    if (taskStr.includes(cap) || cap.includes(taskPrefix)) {
      matches++;
    }
  }

  return Math.min(1, matches / Math.max(1, facultyCapabilities.length)) * 0.4;
}

/** Calculate exploration bonus. */
function calculateExplorationBonus(task: EconomyTask, iteration: number): number {
  // High bonus for never-accessed tasks
  if (task.accessCount === 0) return 1.0;

  // Decay based on time since last access
  const age = iteration - (task.lastAccessed > 0 ? task.lastAccessed : iteration);
  if (age > 100) return 0.5;
  if (age > 50) return 0.3;
  if (age > 10) return 0.1;

  return 0;
}

/** Task alignment (0-1). */
function taskAlignment(a: EconomyTask, b: EconomyTask): number {
  const aStr = a.term.toString();
  const bStr = b.term.toString();

  if (aStr === bStr) return 1.0;
  if (aStr.includes(bStr) || bStr.includes(aStr)) return 0.7;

  const aTokens = new Set(aStr.split(/[\s\(\)\[\],]+/));
  const bTokens = new Set(bStr.split(/[\s\(\)\[\],]+/));
  const intersection = new Set([...aTokens].filter(x => bTokens.has(x)));
  const union = new Set([...aTokens, ...bTokens]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/** Task relevance to belief. */
function taskRelevance(task: EconomyTask, belief: EconomyTask): number {
  return taskAlignment(task, belief);
}

/** Calculate surprise potential. */
function calculateSurprise(task: EconomyTask, belief: EconomyTask): number {
  const taskStr = task.term.toString();
  const beliefStr = belief.term.toString();

  // Direct contradiction
  if (taskStr.startsWith('~') && taskStr.substring(1) === beliefStr) return 1.0;
  if (beliefStr.startsWith('~') && beliefStr.substring(1) === taskStr) return 1.0;

  // Related but different
  const similarity = taskAlignment(task, belief);
  if (similarity > 0.5 && similarity < 0.9) return 0.7; // Potential surprise

  return 0.3; // Default
}

/**
 * Rank tasks by VoI.
 */
export function rankByVoI(
  tasks: EconomyTask[],
  goals: EconomyTask[],
  beliefs: EconomyTask[],
  skills: EconomyTask[],
  oracleCapabilities: string[],
  facultyCapabilities: string[],
  iteration: number
): Array<{ task: EconomyTask; voi: VoIBreakdown }> {
  const ranked: Array<{ task: EconomyTask; voi: VoIBreakdown }> = [];

  for (const task of tasks) {
    const voi = calculateDetailedVoI({
      task,
      goals,
      beliefs,
      skills,
      oracleCapabilities,
      facultyCapabilities,
      iteration,
    });
    ranked.push({ task, voi });
  }

  ranked.sort((a, b) => b.voi.total - a.voi.total);
  return ranked;
}

/**
 * Select task by VoI (for exploration).
 */
export function selectByVoI(
  tasks: EconomyTask[],
  goals: EconomyTask[],
  beliefs: EconomyTask[],
  skills: EconomyTask[],
  oracleCapabilities: string[],
  facultyCapabilities: string[],
  iteration: number,
  rng: () => number
): EconomyTask | null {
  const ranked = rankByVoI(tasks, goals, beliefs, skills, oracleCapabilities, facultyCapabilities, iteration);

  if (ranked.length === 0) return null;

  // Softmax selection based on VoI
  const vois = ranked.map(r => r.voi.total);
  const maxV = Math.max(...vois);
  const expSum = vois.reduce((sum, v) => sum + Math.exp((v - maxV) / 0.5), 0);

  let r = rng() * expSum;
  for (const item of ranked) {
    const prob = Math.exp((item.voi.total - maxV) / 0.5) / expSum;
    r -= prob;
    if (r <= 0) return item.task;
  }

  return ranked[0]?.task ?? null;
}