import { TermBuilder } from '../../terms';
import { conversionRule } from '../builders.js';
import type { RuleFn } from '../types.js';

export const instanceConversion: RuleFn = conversionRule(TermBuilder.instance);
export const propertyConversion: RuleFn = conversionRule(TermBuilder.property);
