import type {Term} from './types.js';
import {TermBuilder} from './factory.js';

export const substituteVariables = (term: Term, bindings: Map<string, Term>): Term => {
if (term.kind === 'atom') {
if (term.isVariable && bindings.has(term.symbol)) {
return bindings.get(term.symbol)!;
}
return term;
}

const newArgs = term.args.map(arg => substituteVariables(arg, bindings));
return TermBuilder.compound(term.kind, newArgs);
};
