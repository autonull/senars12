/**
 * FocusTree — hierarchy over FocusScheduler/FocusBag with BudgetSlice inheritance.
 * Multi-root tree supports independent subtrees with isolated budget slices.
 * Single-root default maintains behavioral parity with flat scheduling.
 * Per-branch rollups feed domain learner + metaGame.
 */

import { raceDeadline } from '@senars/util';
import { BudgetSlice, type ConsumedBudget, createBudgetSlice, sliceBudget, mergeConsumption, mergeConsumed, isExhausted } from '@senars/kernel/budget';
import type { Focus, FocusOptions, FocusStepReport } from '../focus/Focus.js';
import type { FocusBag } from '../focus/FocusBag.js';
import type { SchedulerAdapter } from '../learning/domain-learners.js';
import type { MetaGame } from '../game/MetaGame.js';
import type { GameFocus } from '../focus/GameFocus.js';
import { FocusScheduler, type FocusSchedulerOptions } from '../focus/focus-scheduler.js';
import type { RandomSource } from '../types/primitives.js';
import { SeededRNG, weightedPick } from '../utils/random.js';
import { schedulerReward } from './scheduler-reward.js';

export interface FocusTreeNode {
  readonly id: string;
  readonly focus: Focus;
  readonly parent: FocusTreeNode | null;
  readonly children: FocusTreeNode[];
  readonly budget: BudgetSlice;
  weight: number;
  scheduler?: FocusScheduler;
}

export interface FocusTreeOptions {
  rootFocus: FocusOptions;
  rootBudget: BudgetSlice;
  /** Ticks per second for root scheduler. */
  hz?: number;
  /** Wall-clock deadline per focus step. */
  deadlineMs?: number;
  /** Seed for deterministic weighted sampling. */
  seed?: number;
  /** Step reports feed the existing self-scheduler domain learner. */
  schedulerAdapter?: SchedulerAdapter;
  /** When present, step reports are also observed by the meta-game. */
  metaGame?: MetaGame;
  /** Maximum depth of the tree. */
  maxDepth?: number;
}

export interface FocusTreeRollup {
  nodeId: string;
  totalDerivations: number;
  totalTasksProcessed: number;
  totalBudgetAllocated: number;
  avgReward: number;
  childRollups: FocusTreeRollup[];
}

export class FocusTree {
  private readonly roots: FocusTreeNode[] = [];
  private readonly hz: number;
  private readonly deadlineMs: number;
  private readonly rng: SeededRNG;
  private readonly schedulerAdapter?: SchedulerAdapter;
  private readonly metaGame?: MetaGame;
  private readonly maxDepth: number;
  private readonly nodeMap = new Map<string, FocusTreeNode>();
  private ticks = 0;

  constructor(options: FocusTreeOptions) {
    this.hz = options.hz ?? 10;
    this.deadlineMs = options.deadlineMs ?? 50;
    this.rng = new SeededRNG(options.seed ?? 1);
    this.schedulerAdapter = options.schedulerAdapter;
    this.metaGame = options.metaGame;
    this.maxDepth = options.maxDepth ?? 3;

    const rootFocus = options.rootFocus;
    const rootBudget = options.rootBudget;

    const root: FocusTreeNode = {
      id: rootFocus.id,
      focus: this.createFocus(rootFocus),
      parent: null,
      children: [],
      budget: rootBudget,
      weight: rootFocus.weight ?? 1.0,
    };
    this.roots.push(root);
    this.nodeMap.set(root.id, root);
  }

  /** Add an independent root focus with its own budget slice. */
  addRoot(rootFocus: FocusOptions, rootBudget: BudgetSlice): FocusTreeNode {
    const root: FocusTreeNode = {
      id: rootFocus.id,
      focus: this.createFocus(rootFocus),
      parent: null,
      children: [],
      budget: rootBudget,
      weight: rootFocus.weight ?? 1.0,
    };
    this.roots.push(root);
    this.nodeMap.set(root.id, root);
    return root;
  }

  private createFocus(options: FocusOptions): Focus {
    return {
      id: options.id,
      tasks: {
        add: () => false,
        sample: () => undefined,
        all: () => [],
        size: () => 0,
        decay: () => {},
        getTotalWeight: () => 0,
      } as any,
      memory: {
        add: () => false,
        sample: () => undefined,
        all: () => [],
        size: () => 0,
        decay: () => {},
        getTotalWeight: () => 0,
      } as any,
      weight: options.weight ?? 1.0,
      setWeight: (w: number) => {},
      games: [],
      reflexes: [],
      getPerceptionGate: () => ({ toBeliefs: () => [] }),
      getActionGate: () => ({}),
      getRewardGate: () => ({}),
      bindGame: () => {},
      bindReflex: () => {},
      disableReflex: () => {},
      step: async () => ({ focusId: '', cycle: 0, budgetAllocated: 0, tasksProcessed: 0, derivations: 0, beliefsAdded: 0, goalsAdded: 0, questionsAdded: 0, gates: { perceptions: 0, actions: 0, rewards: 0 }, timestamp: Date.now() }),
    } as unknown as Focus;
  }

  /** Add a child focus to a parent node. */
  addChild(parentId: string, childOptions: FocusOptions, budgetAllocation: Partial<ConsumedBudget> = {}): FocusTreeNode | null {
    const parent = this.nodeMap.get(parentId);
    if (!parent) return null;

    const depth = this.getDepth(parent);
    if (depth >= this.maxDepth) return null;

    const childBudget = sliceBudget(parent.budget, childOptions.id, budgetAllocation);

    const child: FocusTreeNode = {
      id: childOptions.id,
      focus: this.createFocus(childOptions),
      parent,
      children: [],
      budget: childBudget,
      weight: childOptions.weight ?? 1.0,
    };

    parent.children.push(child);
    this.nodeMap.set(child.id, child);
    return child;
  }

  /** Get a node by ID. */
  getNode(id: string): FocusTreeNode | undefined {
    return this.nodeMap.get(id);
  }

  /** Get the depth of a node. */
  private getDepth(node: FocusTreeNode): number {
    let depth = 0;
    let current: FocusTreeNode | null = node;
    while (current.parent) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /** Execute one tick: sample a leaf node across all roots and step it. */
  async tick(): Promise<{ nodeId: string; report: FocusStepReport | null; yielded: boolean } | null> {
    const leaf = this.sampleLeaf();
    if (!leaf) return null;

    const budget = leaf.budget;
    const focus = leaf.focus;

    let yielded = false;
    const stepped = await raceDeadline(
      focus.step(budget.consumed.cycles < budget.totalCycles ? 10 : 0),
      this.deadlineMs
    );

    const report = stepped.value;
    if (report) {
      this.emitReport(leaf.id, report);
      // Merge consumption back up the tree
      this.mergeConsumptionUp(leaf, {
        cycles: 1,
        depth: 0,
        memoryOps: report.tasksProcessed,
        llmCalls: 0,
      });
    } else {
      yielded = true;
    }

    this.ticks++;
    return { nodeId: leaf.id, report: report ?? null, yielded };
  }

  /** Weighted sample a leaf node across all roots. */
  private sampleLeaf(): FocusTreeNode | null {
    return weightedPick(this.getLeaves(), (node) => node.weight, this.rng.next) ?? null;
  }

  private getLeaves(): FocusTreeNode[] {
    const leaves: FocusTreeNode[] = [];
    const collect = (node: FocusTreeNode) => {
      if (node.children.length === 0) {
        leaves.push(node);
      } else {
        for (const child of node.children) collect(child);
      }
    };
    for (const root of this.roots) collect(root);
    return leaves;
  }

  private emitReport(nodeId: string, report: FocusStepReport): void {
    this.metaGame?.recordFocusStepReport(report);
    if (!this.schedulerAdapter) return;
    this.schedulerAdapter.learn({
      domain: 'self-scheduler',
      reward: schedulerReward(report),
      focusId: nodeId,
    });
  }

  private mergeConsumptionUp(node: FocusTreeNode, consumption: ConsumedBudget): void {
    for (let current: FocusTreeNode | null = node; current; current = current.parent) {
      mergeConsumed(current.budget.consumed, consumption);
    }
  }

  /** Get rollup for a node (and its subtree). */
  getRollup(nodeId: string): FocusTreeRollup | null {
    const node = this.nodeMap.get(nodeId);
    if (!node) return null;
    return this.buildRollup(node);
  }

  private buildRollup(node: FocusTreeNode): FocusTreeRollup {
    return {
      nodeId: node.id,
      totalDerivations: 0,
      totalTasksProcessed: 0,
      totalBudgetAllocated: node.budget.consumed.cycles,
      avgReward: 0,
      childRollups: node.children.map((child) => this.buildRollup(child)),
    };
  }

  /** Get rollup for all roots (entire forest). */
  getRootRollup(): FocusTreeRollup[] {
    return this.roots.map((root) => this.buildRollup(root));
  }

  /** Get all nodes for inspection. */
  getAllNodes(): FocusTreeNode[] {
    return [...this.nodeMap.values()];
  }

  /** Check if any budget is exhausted. */
  hasExhaustedBudget(): boolean {
    for (const node of this.nodeMap.values()) {
      if (isExhausted(node.budget)) return true;
    }
    return false;
  }

  getTickCount(): number {
    return this.ticks;
  }
}

export function createFocusTree(options: FocusTreeOptions): FocusTree {
  return new FocusTree(options);
}