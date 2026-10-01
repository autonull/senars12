import { deductionFromType } from '../impls/builders.js';
import type { RuleFn } from '../types.js';

export const instanceDeduction: RuleFn = deductionFromType('setExt', 'subject');
export const propertyInduction: RuleFn = deductionFromType('setInt', 'predicate');
