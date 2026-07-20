import type { MeTTaAtom } from '../types/ast.js';
import type { Subst, Type, TypeEnv, TypeScheme, TypeVar } from './type.js';
export declare const freshType: () => TypeVar;
export declare const resetTypeIds: () => void;
export declare const applyTypeSubst: (t: Type, s: Subst) => Type;
export declare const composeSubst: (s1: Subst, s2: Subst) => Subst;
export declare const occursCheck: (id: number, t: Type, s: Subst) => boolean;
export declare const unifyTypes: (t1: Type, t2: Type, s: Subst) => Subst | null;
export type TypedExpr = {
  atom: MeTTaAtom;
  type: Type;
};
export declare class TypeChecker {
  private env;
  constructor(initialEnv?: TypeEnv);
  addBinding(name: string, scheme: TypeScheme): void;
  infer(atom: MeTTaAtom): {
    type: Type;
    subst: Subst;
  } | null;
  private inferType;
  private instantiate;
  private inferExpr;
}
//# sourceMappingURL=inference.d.ts.map
