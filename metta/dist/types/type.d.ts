export declare enum TypeKind {
    Var = 0,
    Con = 1,
    Fun = 2
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
export declare const typevar: (id: number) => TypeVar;
export declare const typecon: (name: string) => TypeCon;
export declare const typefun: (from: Type, to: Type) => TypeFun;
export declare const isTypeVar: (t: Type) => t is TypeVar;
export declare const isTypeCon: (t: Type) => t is TypeCon;
export declare const isTypeFun: (t: Type) => t is TypeFun;
export type TypeEnv = Map<string, TypeScheme>;
export type Subst = Map<number, Type>;
//# sourceMappingURL=type.d.ts.map