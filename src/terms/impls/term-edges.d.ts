import type { Term } from '../../terms/types';
export interface TermEdge {
    source: string;
    target: string;
    type: 'inheritance' | 'similarity' | 'implication' | 'equivalence' | 'related' | 'derivation';
    weight: number;
    directed: boolean;
}
export declare function parseTermToEdges(term: Term): TermEdge[];
//# sourceMappingURL=term-edges.d.ts.map