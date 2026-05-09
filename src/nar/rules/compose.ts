import type {Term} from '../terms';
import type {RuleFn} from './types.js';

export function composeRules(
  r1: RuleFn,
  r2: RuleFn
): RuleFn {
  return ((premises: Term[]): Term | undefined => {
    const intermediate = r1(premises);
    if (!intermediate) return undefined;
    const result = r2([intermediate, ...(premises.slice(1) || [premises[1]])]);
    return result ?? undefined;
  });
}

export function sequenceRules(...rules: RuleFn[]): RuleFn {
  return (premises: Term[]): Term | undefined => {
    for (const rule of rules) {
      const result = rule(premises);
      if (result) return result;
    }
    return undefined;
  };
}