/**
 * FocusTree — hierarchy over FocusScheduler/FocusBag with BudgetSlice inheritance.
 * Single-root tree must be behaviorally identical to flat scheduling (parity bench).
 * Per-branch rollups feed domain learner + metaGame.
 */

import { BudgetSlice, type ConsumedBudget, createBudgetSlice, sliceBudget, mergeConsumption, isExhausted } from '@senars/kernel/budget';
import type { Focus, FocusOptions, FocusStepReport } from '../focus/Focus.js';
import type { FocusBag } from '../focus/FocusBag.js';
import type { SchedulerAdapter } from '../learning/domain-learners.js';
import type { MetaGame } from '../game/MetaGame.js';
import type { GameFocus } from '../focus/GameFocus.js';
import { FocusScheduler, type FocusSchedulerOptions } from '../focus/focus-scheduler.js';
import type { RandomSource } from '../types/primitives.js';
import { SeededRNG } from '../game/SeededRNG.js';

export interface FocusTreeNode {
  readonly id: string;
  readonly focus: Focus;
  readonly parent: FocusTreeNode | null;
  readonly children: FocusTreeNode[];
  readonly budget: BudgetSlice;
  readonly weight: number;
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
  private readonly root: FocusTreeNode;
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

    this.root = {
      id: rootFocus.id,
      focus: this.createFocus(rootFocus),
      parent: null,
      children: [],
      budget: rootBudget,
      weight: rootFocus.weight ?? 1.0,
    };
    this.nodeMap.set(this.root.id, this.root);
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

  /** Execute one tick: sample a leaf node and step it. */
  async tick(): Promise<{ nodeId: string; report: FocusStepReport | null; yielded: boolean } | null> {
    const leaf = this.sampleLeaf();
    if (!leaf) return null;

    const budget = leaf.budget;
    const focus = leaf.focus;

    let yielded = false;
    const stepped = await Promise.race([
      focus
        .step(budget.consumed.cycles < budget.totalCycles ? 10 : 0)
        .then((r) => ({ report: r, timedOut: false })),
      new Promise<{ report: FocusStepReport | null; timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ report: null, timedOut: true }), this.deadlineMs)
      ),
    ]);

    if (stepped.report) {
      this.emitReport(leaf.id, stepped.report);
      // Merge consumption back up the tree
      this.mergeConsumptionUp(leaf, {
        cycles: 1,
        depth: 0,
        memoryOps: stepped.report.tasksProcessed,
        llmCalls: 0,
      });
    } else {
      yielded = true;
    }

    this.ticks++;
    return { nodeId: leaf.id, report: stepped.report, yielded };
  }

  /** Weighted sample a leaf node. */
  private sampleLeaf(): FocusTreeNode | null {
    const leaves = this.getLeaves();
    if (leaves.length === 0) return null;

    // Weight-proportional selection across all leaves
    const totalWeight = leaves.reduce((sum, n) => sum + n.weight, 0);
    if (totalWeight === 0) return null;

    let roll = this.rng.next() * totalWeight;
    for (const node of leaves) {
      roll -= node.weight;
      if (roll <= 0) return node;
    }
    return leaves[leaves.length - 1] ?? null;
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
    collect(this.root);
    return leaves;
  }

  private emitReport(nodeId: string, report: FocusStepReport): void {
    this.metaGame?.recordFocusStepReport(report);
    if (!this.schedulerAdapter) return;
    const tasks = Math.max(1, report.tasksProcessed);
    const reward = Math.max(-1, Math.min(1, (report.derivations / tasks - 0.5) * 2));
    this.schedulerAdapter.learn({ domain: 'self-scheduler', reward, focusId: nodeId });
  }

  private mergeConsumptionUp(node: FocusTreeNode, consumption: ConsumedBudget): void {
    let current: FocusTreeNode | null = node;
    while (current) {
      current.budget.consumed.cycles += consumption.cycles;
      current.budget.consumed.depth = Math.max(current.budget.consumed.depth, consumption.depth);
      current.budget.consumed.memoryOps += consumption.memoryOps;
      current.budget.consumed.llmCalls += consumption.llmCalls;
      current = current.parent;
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

  /** Get root rollup (entire tree). */
  getRootRollup(): FocusTreeRollup {
    return this.buildRollup(this.root);
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