import {PriorityBag} from '../bag/Bag.js';
import type {BagItem} from '../bag/Bag.js';
import type {Task, Budget, ConceptLike} from '../types/index.js';
import type {Term} from '../terms/index.js';
import {isImplication, isInheritance, isOperation, getPredicate, getArgs, isAtomic} from '../terms/index.js';
import {PerceptionGate} from '../gates/PerceptionGate.js';
import {ActionGate} from '../gates/ActionGate.js';
import {RewardGate} from '../gates/RewardGate.js';
import type {Game, Perception, GameOutcome} from '../game/Game.js';
import type {ActionProposal, Reflex, LearningEvent} from '../reflex/Reflex.js';
import type {NALDerivation} from '../reflex/Negotiator.js';
import {gateRegistry} from '../kernel/index.js';

export interface FocusTask extends BagItem {
  id: string;
  priority: number;
  term: Term;
  type: 'belief' | 'goal' | 'question';
  truth: { f: number; c: number };
  budget: Budget;
  stamp: string;
  derived: boolean;
}

export interface FocusConcept extends BagItem {
  id: string;
  priority: number;
  term: Term;
  activation: number;
  totalTasks: number;
}

export interface FocusStepReport {
  focusId: string;
  cycle: number;
  budgetAllocated: number;
  tasksProcessed: number;
  derivations: number;
  beliefsAdded: number;
  goalsAdded: number;
  questionsAdded: number;
  gates: {
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
}

export class Focus implements BagItem {
  readonly id: string;
  readonly tasks: PriorityBag<FocusTask>;
  readonly memory: PriorityBag<FocusConcept>;
  weight: number;

  private cycle = 0;
  private readonly perceptionGate: PerceptionGate;
  private readonly actionGate: ActionGate;
  private readonly rewardGate: RewardGate;

  readonly games: Game[] = [];
  reflexes: Reflex[] = [];

  constructor(options: FocusOptions) {
    this.id = options.id;
    this.weight = options.weight ?? 1.0;

    this.tasks = new PriorityBag<FocusTask>({
      capacity: options.taskCapacity ?? 1000,
      decayRate: options.taskDecayRate ?? 0.01,
    });

    this.memory = new PriorityBag<FocusConcept>({
      capacity: options.conceptCapacity ?? 500,
      decayRate: options.conceptDecayRate ?? 0.005,
    });

    this.perceptionGate = new PerceptionGate(this);
    this.actionGate = new ActionGate(this);
    this.rewardGate = new RewardGate(this);
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
      gates: { perceptions: 0, actions: 0, rewards: 0 },
      timestamp: Date.now(),
    };

    if (!gateRegistry.getBudgetGate().check({ operation: 'nal-step', estimatedCost: 1 }).granted) return report;

    // PERCEPTION: Bound Games inject observations into the Focus
    for (const game of this.games) {
      const perception = game.observe();
      const beliefs = this.perceptionGate.toBeliefs(perception);
      for (const belief of beliefs) {
        this.tasks.add(belief);
      }
      report.gates.perceptions += beliefs.length;
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
      concept.activation = Math.min(1, concept.activation + 0.1);
      concept.totalTasks++;
    } else {
      concept = {
        id,
        priority,
        term,
        activation: priority,
        totalTasks: 1,
      };
      this.memory.add(concept);
    }
  }

  private findConcept(id: string): FocusConcept | undefined {
    for (const c of this.memory.all()) {
      if (c.id === id) return c;
    }
    return undefined;
  }

  getPerceptionGate(): PerceptionGate {
    return this.perceptionGate;
  }

  getActionGate(): ActionGate {
    return this.actionGate;
  }

  getRewardGate(): RewardGate {
    return this.rewardGate;
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

  getNALDerivations(action: string): NALDerivation[] {
    const derivations: NALDerivation[] = [];

    for (const concept of this.memory.all()) {
      const term = concept.term;
      if (!term || typeof term !== 'object') continue;

      let actionMatches = false;
      let isRelevantRelation = false;

      if (isOperation(term)) {
        const op = getPredicate(term);
        const args = getArgs(term);
        const firstArg = args[0];
        if (
          op &&
          isAtomic(op) &&
          op.symbol.startsWith('^') &&
          op.symbol.slice(1) === action &&
          firstArg &&
          firstArg.kind === 'atom' &&
          'value' in firstArg &&
          firstArg.value === action
        ) {
          actionMatches = true;
        }
      }

      if (isImplication(term) || isInheritance(term)) {
        isRelevantRelation = true;
      }

      if (actionMatches && isRelevantRelation) {
        const truth = { f: concept.activation, c: Math.min(1, concept.priority) };
        derivations.push({
          action,
          truth,
          source: 'focus-memory',
        });
      }
    }

    return derivations;
  }
}