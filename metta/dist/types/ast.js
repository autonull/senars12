export var AtomKind;
((AtomKind) => {
  AtomKind[(AtomKind['Symbol'] = 0)] = 'Symbol';
  AtomKind[(AtomKind['Variable'] = 1)] = 'Variable';
  AtomKind[(AtomKind['Number'] = 2)] = 'Number';
  AtomKind[(AtomKind['String'] = 3)] = 'String';
  AtomKind[(AtomKind['Expression'] = 4)] = 'Expression';
  AtomKind[(AtomKind['Grounded'] = 5)] = 'Grounded';
})(AtomKind || (AtomKind = {}));
export const sym = (value) => ({
  kind: AtomKind.Symbol,
  value,
});
export const varr = (name) => ({
  kind: AtomKind.Variable,
  name,
});
export const num = (value) => ({
  kind: AtomKind.Number,
  value,
});
export const str = (value) => ({
  kind: AtomKind.String,
  value,
});
export const expr = (operator, ...args) => ({
  kind: AtomKind.Expression,
  operator,
  args,
});
export const isSymbol = (a) => a.kind === AtomKind.Symbol;
export const isVariable = (a) => a.kind === AtomKind.Variable;
export const isNumber = (a) => a.kind === AtomKind.Number;
export const isString = (a) => a.kind === AtomKind.String;
export const isExpression = (a) => a.kind === AtomKind.Expression;
export const isGrounded = (a) => a.kind === AtomKind.Grounded;
//# sourceMappingURL=ast.js.map
