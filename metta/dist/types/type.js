export var TypeKind;
((TypeKind) => {
  TypeKind[(TypeKind['Var'] = 0)] = 'Var';
  TypeKind[(TypeKind['Con'] = 1)] = 'Con';
  TypeKind[(TypeKind['Fun'] = 2)] = 'Fun';
})(TypeKind || (TypeKind = {}));
export const typevar = (id) => ({ kind: TypeKind.Var, id });
export const typecon = (name) => ({ kind: TypeKind.Con, name });
export const typefun = (from, to) => ({ kind: TypeKind.Fun, from, to });
export const isTypeVar = (t) => t.kind === TypeKind.Var;
export const isTypeCon = (t) => t.kind === TypeKind.Con;
export const isTypeFun = (t) => t.kind === TypeKind.Fun;
//# sourceMappingURL=type.js.map
