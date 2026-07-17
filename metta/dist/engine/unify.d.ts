import type { MeTTaAtom } from '../types/ast.js';
export type Substitution = Map<string, MeTTaAtom>;
export declare function unify(a: MeTTaAtom, b: MeTTaAtom, subst?: Substitution): Substitution | null;
export declare function applySubst(atom: MeTTaAtom, subst: Substitution): MeTTaAtom;
//# sourceMappingURL=unify.d.ts.map