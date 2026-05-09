import type {Term} from '../terms';
import type {Task} from '../types';

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

export class ReasoningTrace {
    private readonly memory: any;
    private readonly derivationHistory: Map<string, DerivationNode> = new Map();

    constructor(memory: any) {
        this.memory = memory;
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

            if (concept.beliefBag) {
                for (const belief of concept.beliefBag.toArray()) {
                    history.push({
                        term: concept.term,
                        type: 'belief',
                        truth: belief.truth,
                        budget: belief.budget,
                        stamp: (belief as any).stamp,
                        occurrenceTime: (belief as any).occurrenceTime || Date.now(),
                        derived: (belief as any).derived || false
                    } as Task);
                }
            }

            const relatedConcepts = this.memory.getRelatedConcepts(term);
            for (const related of relatedConcepts) {
                concepts.push(related.term.toString());
            }
        }

        return {
            term,
            history,
            concepts
        };
    }

  explain(conclusion: Task): ExplainResult {
    const premises: Task[] = [];
    const rules: string[] = [];
    const confidence = conclusion.truth.f * conclusion.truth.c;

    const history = this.getDerivationHistory(conclusion);
    premises.push(...history.filter(t => t.stamp.id !== conclusion.stamp.id));

    if (conclusion.stamp.derivations) {
      for (const deriv of conclusion.stamp.derivations) {
        if (deriv.rule) rules.push(deriv.rule);
      }
    }

    return {
      conclusion,
      premises,
      rules,
      confidence,
      why: this.generateExplanation(conclusion, premises, confidence)
    };
  }

  recordDerivation(task: Task, rule?: string): void {
    const node: DerivationNode = {
      task,
      children: [],
      rule,
      timestamp: Date.now()
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
      nodeCount
    };
  }

  private populateChildren(node: DerivationNode, visited: Set<string>): void {
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

  getDerivationPath(task: Task): string[] {
    const path: string[] = [];
    let currentStamp = task.stamp;

    while (currentStamp && path.length < 20) {
      path.push(currentStamp.id);

      if (!currentStamp.derivations || currentStamp.derivations.length === 0) {
        break;
      }

      const parentStamp = currentStamp.derivations[0]?.parent;
      if (!parentStamp) break;
      currentStamp = parentStamp;
    }

    return path.reverse();
  }

    private buildNode(task: Task): DerivationNode {
        return {
            task,
            children: [],
            timestamp: task.occurrenceTime || Date.now()
        };
    }

    private calculateDepth(node: DerivationNode): number {
        if (node.children.length === 0) {
            return 1;
        }

        const childDepths = node.children.map(child => this.calculateDepth(child));
        return 1 + Math.max(...childDepths);
    }

    private countNodes(node: DerivationNode): number {
        let count = 1;
        for (const child of node.children) {
            count += this.countNodes(child);
        }
        return count;
    }

    private collectDerivationHistory(task: Task, history: Task[], visited: Set<string>): void {
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

        const premiseStrs = premises.slice(0, 3).map(p => p.term.toString());
        const confidenceStr = (confidence * 100).toFixed(1);

        return `Derived from ${premises.length} premise(s): ${premiseStrs.join(', ')}. Confidence: ${confidenceStr}%.`;
    }
}

export const createReasoningTrace = (memory: any): ReasoningTrace => {
    return new ReasoningTrace(memory);
};
