import { TermBuilder } from '../../terms';
import { conversionRule } from '../impls/builders.js';
import type { RuleFn } from '../types.js';

export const instanceConversion: RuleFn = conversionRule(TermBuilder.setExt);
export const propertyConversion: RuleFn = conversionRule(TermBuilder.setInt);
