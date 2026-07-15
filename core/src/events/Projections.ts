import type { CognitiveEvent } from './EventTypes.js';
import type { GraphOp, GraphNodeData, Lens } from '../Protocol.js';
import { projectFact } from './FactProjection.js';

type DerivationMade = { premises: string[]; conclusion: string; rule: string };
type InputUser = { text: string };
type ToolResponse = { error?: string; result?: unknown };

export function projectGraph(event: CognitiveEvent): GraphOp[] {
  const facts = projectFact(event);
  const ops: GraphOp[] = [];

  for (const fact of facts) {
    if (fact.deleted) {
      ops.push({ action: 'remove_node', id: fact.id });
    } else {
      const nodeType = fact.engine === 'nar' ? 'nar:concept' : 'metta:atom';
      const nodeData: GraphNodeData = {
        id: fact.id,
        nodeType,
        label: fact.term,
        term: fact.term,
        ...(fact.truth ? { truth: fact.truth, confidence: fact.truth.confidence, priority: 0.5 } : {}),
        ...(fact.space ? { atom: fact.term, space: fact.space, priority: 0.9, confidence: 1.0 } : {}),
      } as GraphNodeData;
      ops.push({ action: 'add_node', id: fact.id, data: nodeData });
    }
  }

  if (event.type === 'derivation.made') {
    const { premises, conclusion } = event.payload as DerivationMade;
    for (const p of premises) {
      ops.push({
        action: 'add_edge',
        source: hashTerm(p),
        target: hashTerm(conclusion),
        data: { weight: 0.6, type: 'inference', directed: true },
      });
    }
  }

  return ops;
}

export function projectChat(event: CognitiveEvent): { role: 'user' | 'assistant'; content: string } | null {
  if (event.type === 'input.user') return { role: 'user', content: (event.payload as InputUser).text };
  if (event.type === 'tool.response' && !(event.payload as ToolResponse).error) return { role: 'assistant', content: String((event.payload as ToolResponse).result ?? '') };
  return null;
}

export function projectLens(event: CognitiveEvent, lens: Lens): GraphOp[] {
  const base = projectGraph(event);
  return base.filter(op => lensFilter(op, lens));
}

function hashTerm(term: string): string {
  const result = term.replace(/[^a-zA-Z0-9_:.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const final: string = result || 'unknown';
  return `nar:${final}`;
}

function lensFilter(_op: GraphOp, _lens: Lens): boolean {
  return true;
}