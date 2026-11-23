/** @public Structural unification over an arbitrary term AST (Narsese, MeTTa). */
export type {
  EqualityDialect,
  Substitution as UnifierSubstitution,
  UnifierDialect,
  UnifyOptions,
  VariablePolicy,
} from '../unify';
export { structuralEqual, Unifier } from '../unify';