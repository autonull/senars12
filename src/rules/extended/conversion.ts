import { TermBuilder } from '../../terms';
import { conversionRule } from '../impls/rule-builder';
import type { RuleFn } from '../types';

export const instanceConversion: RuleFn = conversionRule(TermBuilder.setExt);
export const propertyConversion: RuleFn = conversionRule(TermBuilder.setInt);
