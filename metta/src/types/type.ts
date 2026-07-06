export enum TypeKind {
  Var = 0,
  Con = 1,
  Fun = 2,
}

export interface TypeVar {
  readonly kind: TypeKind.Var;
  readonly id: number;
}

export interface TypeCon {
  readonly kind: TypeKind.Con;
  readonly name: string;
}

export interface TypeFun {
  readonly kind: TypeKind.Fun;
  readonly from: Type;
  readonly to: Type;
}

export type Type = TypeVar | TypeCon | TypeFun;

export interface TypeScheme {
  readonly vars: readonly number[];
  readonly type: Type;
}

export const typevar = (id: number): TypeVar => ({ kind: TypeKind.Var, id });
export const typecon = (name: string): TypeCon => ({ kind: TypeKind.Con, name });
export const typefun = (from: Type, to: Type): TypeFun => ({ kind: TypeKind.Fun, from, to });

export const isTypeVar = (t: Type): t is TypeVar => t.kind === TypeKind.Var;
export const isTypeCon = (t: Type): t is TypeCon => t.kind === TypeKind.Con;
export const isTypeFun = (t: Type): t is TypeFun => t.kind === TypeKind.Fun;

export type TypeEnv = Map<string, TypeScheme>;
export type Subst = Map<number, Type>;