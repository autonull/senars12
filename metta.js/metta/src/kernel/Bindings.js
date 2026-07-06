import {Term} from './Term.js';

export const objToBindingsAtom = (bindings = {}) =>
    Term.exp('Bindings', Object.entries(bindings).map(([k, v]) => Term.exp('Pair', [Term.var(k), v])));

export const bindingsAtomToObj = (bindingsAtom) => {
    if (bindingsAtom?.operator?.name !== 'Bindings') {
        return {};
    }
    return (bindingsAtom.components ?? []).reduce((acc, pair) => {
        if (pair?.operator?.name === 'Pair' && pair.components?.[1] && pair.components[0]?.name) {
            acc[pair.components[0].name] = pair.components[1];
        }
        return acc;
    }, {});
};
