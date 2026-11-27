import { TermBuilder } from '../../terms';
import { conversionRule } from '../impls/rule-builder';
export const instanceConversion = conversionRule(TermBuilder.setExt);
export const propertyConversion = conversionRule(TermBuilder.setInt);
