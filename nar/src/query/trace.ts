import { BoundedMap, maxScore, pct, takeFirst, unique } from '@senars/util';
import { type Concept, taskFromBagItem } from '../memory';
import type { MemoryReader } from '../memory/ports/index.js';
import type { Term } from '../terms';
import { Stamp, Truth } from '../terms';
import type { Task } from '../types';

export interface DerivationNode {
  task: Task;
  children: DerivationNode[];
  rule?: string;
  timestamp: number;
}

export interface DerivationTree {
  root: DerivationNode;
  depth: number;
  nodeCount: number;
}

export interface TraceResult {
  term: Term;
  history: Task[];
  derivationTree?: DerivationTree;
  concepts: string[];
}

export interface ExplainResult {
  conclusion: Task;
  premises: Task[];
  rules: string[];
  confidence: number;
  why: string;
}

/**
 * What a trace reads: one concept by term, and its neighbours. A slice of the
 * one memory port rather than a second `MemoryReader` that a widened
 * `ConceptReader` or `StatisticsView` would silently leave behind.
 */
export type TraceMemory = Pick<MemoryReader, 'getConcept' | 'getRelatedConcepts'>;

export class ReasoningTrace {
  private readonly memory: TraceMemory;
  private readonly derivationHistory: BoundedMap<string, DerivationNode>;

  constructor(memory: TraceMemory, maxDerivations = 1000) {
    this.memory = memory;
    this.derivationHistory = new BoundedMap<string, DerivationNode>({
      maxSize: maxDerivations,
      eviction: 'fifo',
    });
  }

  getDerivationHistory(task: Task): Task[] {
    const history: Task[] = [];
    this.collectDerivationHistory(task, history, new Set());
    return history;
  }

  trace(term: Term): TraceResult {
    const concept = this.memory.getConcept(term);
    const history: Task[] = [];
    const concepts: string[] = [];

    if (concept) {
      concepts.push(term.toString());

      for (const belief of concept.beliefBag.toArray()) {
        history.push(taskFromBagItem(belief, 'belief', concept.priority));
      }

      const relatedConcepts = this.memory.getRelatedConcepts(term);
      for (const related of relatedConcepts) {
        concepts.push(related.term.toString());
      }
    }

    return {
      term,
      history,
      concepts,
    };
  }

  explain(conclusion: Task): ExplainResult {
    const premises: Task[] = [];
    const rules: string[] = [];
    const confidence = Truth.attention(conclusion.truth);

    const history = this.getDerivationHistory(conclusion);
    premises.push(...history.filter((t) => t.stamp.id !== conclusion.stamp.id));

    // Extract rules from derivation history
    for (const task of history) {
      const node = this.derivationHistory.get(task.stamp.id);
      if (node?.rule) {
        rules.push(node.rule);
      }
    }

    return {
      conclusion,
      premises,
      rules: unique(rules),
      confidence,
      why: this.generateExplanation(conclusion, premises, confidence),
    };
  }

  recordDerivation(task: Task, rule?: string): void {
    const node: DerivationNode = {
      task,
      children: [],
      rule,
      timestamp: Date.now(),
    };
    this.derivationHistory.set(task.stamp.id, node);
  }

  buildDerivationTree(task: Task): DerivationTree {
    const root = this.buildNode(task);
    this.populateChildren(root, new Set());
    const depth = this.calculateDepth(root);
    const nodeCount = this.countNodes(root);

    return {
      root,
      depth,
      nodeCount,
    };
  }

  /**
   * How this task was reached: its stamp's full lineage, root-most first.
   *
   * A second walk over `derivationHistory` answered this once and could only
   * follow a single parent chain; the stamp already carries every ancestor, so
   * one reader answers it for an input task and a deeply derived one alike.
   */
  getDerivationPath(task: Task): string[] {
    return Stamp.lineage(task.stamp);
  }

  private populateChildren(node: DerivationNode, visited: Set<string>): void {
    if (!node.task.stamp?.id) return;
    const stampId = node.task.stamp.id;
    if (visited.has(stampId)) return;
    visited.add(stampId);

    const derivationIds = node.task.stamp.derivations || [];
    if (derivationIds.length === 0) return;

    for (const derivId of derivationIds) {
      const parent = this.derivationHistory.get(derivId);
      if (parent && !visited.has(derivId)) {
        node.children.push(parent);
        this.populateChildren(parent, visited);
      }
    }
  }

  private buildNode(task: Task): DerivationNode {
    return {
      task,
      children: [],
      timestamp: task.occurrenceTime || Date.now(),
    };
  }

  private calculateDepth(node: DerivationNode): number {
    if (node.children.length === 0) {
      return 1;
    }

    const childDepths = node.children.map((child) => this.calculateDepth(child));
    return 1 + maxScore(childDepths, (d) => d);
  }

  private countNodes(node: DerivationNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  private collectDerivationHistory(task: Task, history: Task[], visited: Set<string>): void {
    if (!task.stamp?.id) return;
    const key = task.stamp.id;

    if (visited.has(key)) {
      return;
    }

    visited.add(key);
    history.push(task);
  }

  private generateExplanation(conclusion: Task, premises: Task[], confidence: number): string {
    if (premises.length === 0) {
      return 'This is a base belief with no derived premises.';
    }

    const premiseStrs = takeFirst(premises, 3).map((p) => p.term.toString());
    const confidenceStr = pct(confidence);

    return `Derived from ${premises.length} premise(s): ${premiseStrs.join(', ')}. Confidence: ${confidenceStr}.`;
  }
}

export const createReasoningTrace = (memory: TraceMemory): ReasoningTrace => {
  return new ReasoningTrace(memory);
};
