import type { MeTTaAtom } from '../types/ast.js';
export interface RewriteRule {
    name: string;
    match: (atom: MeTTaAtom) => MeTTaAtom | null;
}
export declare class EGraph {
    private eclasses;
    private hashCons;
    private nextIdCounter;
    add(atom: MeTTaAtom): number;
    saturate(rules: readonly RewriteRule[]): void;
    extract(root: number, costFn: (atom: MeTTaAtom) => number): MeTTaAtom;
    private applyRule;
    private hashKey;
    private nextId;
}
//# sourceMappingURL=egraph.d.ts.map