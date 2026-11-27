import { deductionFromType } from '../impls/rule-builder';
export const instanceDeduction = deductionFromType('setExt', 'subject');
export const propertyInduction = deductionFromType('setInt', 'predicate');
