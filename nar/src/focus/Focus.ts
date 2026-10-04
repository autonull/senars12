import { type Clock, clamp01, getOrInsert, systemClock } from '@senars/util';
import type { Bag, BagItem } from '../bag/Bag.js';
import { createBag } from '../bag/index.js';
import type { Game } from '../game/Game.js';
import type { GateRegistry } from '../kernel/index.js';
import type { NALDerivation } from '../reflex/Negotiator.js';
import type { LearningEvent, Reflex } from '../reflex/Reflex.js';
import type { Term } from '../terms/index.js';
import {
  getAntecedent,
  getSubject,
  isAtomic,
  isImplication,
  isInheritance,
  isOperation,
  operationNameOf,
} from '../terms/index.js';
import type { RandomSource } from '../types/primitives.js';
import { type FocusConcept, type FocusTask, perceptionTasks } from './task.js';

export type { FocusConcept, FocusTask } from './task.js';

export interface FocusStepReport {
  focusId: string;
  cycle: number;
  budgetAllocated: number;
  tasksProcessed: number;
  derivations: number;
  beliefsAdded: number;
  goalsAdded: number;
  questionsAdded: number;
  /** Tasks projected into the bag, by record kind. Admission counts, not gate decisions. */
  projected: {
    perceptions: number;
    actions: number;
    rewards: number;
  };
  timestamp: number;
}

export interface FocusOptions {
  id: string;
  taskCapacity?: number;
  conceptCapacity?: number;
  taskDecayRate?: number;
  conceptDecayRate?: number;
  weight?: number;
  /** Required: a focus admits and rewards through gates the owner chose (TODO19 F2, TODO33 §5.P2.7). */
  gateRegistry: GateRegistry;
  /** P1 (TODO20): injectable RNG for deterministic replay of task/memory sampling. */
  rng?: RandomSource;
  /** Injectable time source for task stamps; a pinned clock reproduces a step's ids. */
  clock?: Clock;
}

export class Focus implements BagItem {
  readonly id: string;
  readonly tasks: Bag<FocusTask>;
  readonly memory: Bag<FocusConcept>;
  weight: number;

  private cycle = 0;
  private gates: GateRegistry;
  private readonly clock: Clock;

  readonly games: Game[] = [];
  reflexes: Reflex[] = [];

  constructor(options: FocusOptions) {
    this.id = options.id;
    this.weight = options.weight ?? 1.0;
    this.gates = options.gateRegistry;
    this.clock = options.clock ?? systemClock;

    this.tasks = createBag<FocusTask>({
      capacity: options.taskCapacity ?? 1000,
      decayRate: options.taskDecayRate ?? 0.01,
      rng: options.rng,
    });

    this.memory = createBag<FocusConcept>({
      capacity: options.conceptCapacity ?? 500,
      decayRate: options.conceptDecayRate ?? 0.005,
      rng: options.rng,
    });
  }

  get priority(): number {
    return this.weight;
  }

  setWeight(weight: number): void {
    this.weight = Math.max(0, weight);
  }

  async step(budget: number): Promise<FocusStepReport> {
    this.cycle++;
    const report: FocusStepReport = {
      focusId: this.id,
      cycle: this.cycle,
      budgetAllocated: budget,
      tasksProcessed: 0,
      derivations: 0,
      beliefsAdded: 0,
      goalsAdded: 0,
      questionsAdded: 0,
      projected: { perceptions: 0, actions: 0, rewards: 0 },
      timestamp: this.clock(),
    };

    if (
      !this.gates
        .getBudgetGate()
        .check({ operation: 'nal-step', estimatedCost: 1, scopeId: this.id }).granted
    )
      return report;

    // PERCEPTION: bound Games inject observations into the Focus
    for (const game of this.games) {
      const beliefs = perceptionTasks(game.observe(), this.clock);
      for (const belief of beliefs) {
        this.tasks.add(belief);
      }
      report.projected.perceptions += beliefs.length;
    }

    // Note: PROPOSAL and EXECUTION are handled by GameFocus/outside loop
    // Focus.step() only handles perception and task processing

    const processed = this.processTasks(budget);
    report.tasksProcessed = processed.count;
    report.derivations = processed.derivations;
    report.beliefsAdded = processed.beliefs;
    report.goalsAdded = processed.goals;
    report.questionsAdded = processed.questions;

    this.tasks.decay();
    this.memory.decay();

    return report;
  }

  private processTasks(budget: number): {
    count: number;
    derivations: number;
    beliefs: number;
    goals: number;
    questions: number;
  } {
    let processed = 0;
    let derivations = 0;
    let beliefs = 0;
    let goals = 0;
    let questions = 0;
    let remainingBudget = budget;

    while (remainingBudget > 0 && this.tasks.size() > 0) {
      const task = this.tasks.sample();
      if (!task) break;

      remainingBudget--;
      processed++;

      switch (task.type) {
        case 'belief':
          this.addConcept(task.term, task.truth, task.budget.priority);
          beliefs++;
          break;
        case 'goal':
          goals++;
          break;
        case 'question':
          questions++;
          break;
      }

      derivations++;
    }

    return { count: processed, derivations, beliefs, goals, questions };
  }

  private addConcept(term: Term, truth: { f: number; c: number }, priority: number): void {
    const id = term.toString();
    let concept = this.findConcept(id);
    if (concept) {
      concept.priority = Math.max(concept.priority, priority);
      concept.activation = clamp01(concept.activation + 0.1);
      concept.totalTasks++;
    } else {
      concept = {
        id,
        priority,
        term,
        truth,
        activation: priority,
        totalTasks: 1,
      };
      this.memory.add(concept);
    }
  }

  private findConcept(id: string): FocusConcept | undefined {
    return this.memory.find((c) => c.id === id);
  }

  bindGame(game: Game): void {
    this.games.push(game);
  }

  bindReflex(reflex: Reflex): void {
    this.reflexes.push(reflex);
  }

  disableReflex(reflexId: string): void {
    this.reflexes = this.reflexes.filter((r) => r.id !== reflexId);
  }

  private derivationIndexVersion = -1;
  private derivationIndex = new Map<string, NALDerivation[]>();

  /**
   * Derivations relevant to an action, served from an index rebuilt only when
   * the focus memory mutates (X23 hot-path fix) instead of scanning per call.
   */
  getNALDerivations(action: string): NALDerivation[] {
    if (this.derivationIndexVersion !== this.memory.version) {
      this.derivationIndexVersion = this.memory.version;
      this.derivationIndex = this.buildDerivationIndex();
    }
    return this.derivationIndex.get(action) ?? [];
  }

  private buildDerivationIndex(): Map<string, NALDerivation[]> {
    const index = new Map<string, NALDerivation[]>();
    const record = (action: string, concept: FocusConcept): void => {
      getOrInsert(index, action, () => []).push({
        action,
        truth: concept.truth ?? { f: concept.activation, c: clamp01(concept.priority) },
        source: 'focus-memory',
        premise: concept.term.toString(),
      });
    };

    for (const concept of this.memory.all()) {
      const term = concept.term;
      if (!term || typeof term !== 'object') continue;

      // Operation: `act(...)` — the operator atom names the action.
      if (isOperation(term)) {
        const action = operationNameOf(term);
        if (action) record(action, concept);
        continue;
      }

      // Implication/inheritance: the antecedent/subject atom names the action.
      if (isImplication(term) || isInheritance(term)) {
        const subject = getAntecedent(term) ?? getSubject(term);
        if (subject && isAtomic(subject) && subject.symbol) record(subject.symbol, concept);
      }
    }
    return index;
  }
}
