import type { CognitiveEvent } from './EventTypes.js';
import type { GraphOp, GraphNodeData, Lens } from '../Protocol.js';

type BeliefAdded = { term: string; truth: { frequency: number; confidence: number } };
type BeliefRetracted = { term: string };
type AtomDerived = { atom: string; space: string };
type DerivationMade = { premises: string[]; conclusion: string; rule: string };
type InputUser = { text: string };
type ToolResponse = { error?: string; result?: unknown };

export function projectGraph(event: CognitiveEvent): GraphOp[] {
  switch (event.type) {
    case 'belief.added': {
      const { term, truth } = event.payload as BeliefAdded;
      const id = hashTerm(term);
      const nodeData: GraphNodeData = {
        id,
        nodeType: 'nar:concept',
        label: term,
        term,
        truth,
        priority: 0.5,
        confidence: truth.confidence,
      };
      return [{ action: 'add_node', id, data: nodeData }];
    }
    case 'belief.retracted': {
      const { term } = event.payload as BeliefRetracted;
      return [{ action: 'remove_node', id: hashTerm(term) }];
    }
    case 'atom.derived': {
      const { atom, space } = event.payload as AtomDerived;
      const id = hashAtom(atom);
      const nodeData: GraphNodeData = {
        id,
        nodeType: 'metta:atom',
        label: atom,
        atom,
        space,
        priority: 0.9,
        confidence: 1.0,
      };
      return [{ action: 'add_node', id, data: nodeData }];
    }
    case 'derivation.made': {
      const { premises, conclusion, rule } = event.payload as DerivationMade;
      return premises.map(p => ({
        action: 'add_edge',
        source: hashTerm(p),
        target: hashTerm(conclusion),
        data: { weight: 0.6, type: 'inference', directed: true },
      }));
    }
    default:
      return [];
  }
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

function hashAtom(atom: string): string {
  const result = atom.replace(/[^a-zA-Z0-9_:.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const final: string = result || 'unknown';
  return `metta:${final}`;
}

function lensFilter(_op: GraphOp, _lens: Lens): boolean {
  return true;
}