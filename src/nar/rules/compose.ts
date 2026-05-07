import type {Term} from '../terms';
import type {RuleFn} from './types.js';

export function composeRules(
    r1: RuleFn,
    r2: RuleFn
): (premises: [Term, Term]) => Term | undefined {
    return (premises: [Term, Term]): Term | undefined => {
        const intermediate = r1(premises);
        if (!intermediate) return undefined;
        return r2([intermediate as Term, premises[1]]);
    };
}

export function sequenceRules(...rules: RuleFn[]): RuleFn {
    return ((premises) => {
        for (const rule of rules) {
            const result = rule(premises);
            if (result) return result;
        }
        return undefined;
    }) as RuleFn;
}