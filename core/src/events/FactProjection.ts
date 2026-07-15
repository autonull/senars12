import type { CognitiveEvent } from './EventTypes.js';

export type UnifiedFact = {
  id: string;
  term: string;
  engine: 'nar' | 'metta';
  truth?: { frequency: number; confidence: number };
  space?: string;
  source: 'input' | 'derivation' | 'tool';
  derivedAt: number;
  deleted?: boolean;
};

function hashTerm(term: string): string {
  const result = term.replace(/[^a-zA-Z0-9_:.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (result || 'unknown');
}

export function projectFact(event: CognitiveEvent): UnifiedFact[] {
  switch (event.type) {
    case 'belief.added': {
      const payload = event.payload as { term: string; truth: { frequency: number; confidence: number } };
      return [{ id: hashTerm(payload.term), term: payload.term, engine: 'nar', truth: payload.truth, source: 'derivation', derivedAt: event.timestamp }];
    }
    case 'atom.derived': {
      const payload = event.payload as { atom: string; space: string };
      return [{ id: hashTerm(payload.atom), term: payload.atom, engine: 'metta', space: payload.space, source: 'derivation', derivedAt: event.timestamp }];
    }
    case 'belief.retracted': {
      const payload = event.payload as { term: string };
      return [{ id: hashTerm(payload.term), term: payload.term, engine: 'nar', source: 'derivation', derivedAt: event.timestamp, deleted: true }];
    }
    case 'atom.retracted': {
      const payload = event.payload as { atom: string; space: string };
      return [{ id: hashTerm(payload.atom), term: payload.atom, engine: 'metta', space: payload.space, source: 'derivation', derivedAt: event.timestamp, deleted: true }];
    }
    case 'input.user': {
      const payload = event.payload as { text: string };
      return [{ id: hashTerm(payload.text), term: payload.text, engine: 'nar', source: 'input', derivedAt: event.timestamp }];
    }
    default:
      return [];
  }
}
