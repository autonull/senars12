/**
 * Conversion extended NAL rules: instance and property conversion.
 */
import type { Term } from '../../terms';
import { TermBuilder } from '../../terms';
import type { RuleFn } from '../types.js';
import { conversionRule } from '../builders.js';

export const instanceConversion: RuleFn = conversionRule(TermBuilder.instance);
export const propertyConversion: RuleFn = conversionRule(TermBuilder.property);
