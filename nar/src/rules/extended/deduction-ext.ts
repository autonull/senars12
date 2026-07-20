import { deductionFromType } from '../builders.js';
import type { RuleFn } from '../types.js';

export const instanceDeduction: RuleFn = deductionFromType('instance', 'subject');
export const propertyInduction: RuleFn = deductionFromType('property', 'predicate');
