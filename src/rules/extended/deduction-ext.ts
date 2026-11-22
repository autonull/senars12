import { deductionFromType } from '../impls/rule-builder';
import type { RuleFn } from '../types';

export const instanceDeduction: RuleFn = deductionFromType('setExt', 'subject');
export const propertyInduction: RuleFn = deductionFromType('setInt', 'predicate');
