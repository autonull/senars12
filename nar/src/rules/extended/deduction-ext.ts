/**
 * Deduction/induction extended NAL rules keyed on instance and property types.
 */
import type { Term } from '../../terms';
import type { RuleFn } from '../types.js';
import { deductionFromType } from '../builders.js';

export const instanceDeduction: RuleFn = deductionFromType('instance', 'subject');
export const propertyInduction: RuleFn = deductionFromType('property', 'predicate');
