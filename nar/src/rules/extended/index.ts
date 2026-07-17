/**
 * NALExtendedRules — consolidated map of extended NAL inference rules.
 */
import type { RuleFn } from '../types.js';
import * as classical from './classical.js';
import * as structural from './structural.js';
import * as composition from './composition.js';
import * as equivalence from './equivalence.js';
import * as variable from './variable.js';
import * as conversion from './conversion.js';
import * as deductionExt from './deduction-ext.js';
import * as temporal from './temporal.js';
import * as procedural from './procedural.js';
import * as comparisonExt from './comparison-ext.js';
import * as meta from './meta/index.js';

export const NALExtendedRules = {
  ...classical,
  ...structural,
  ...composition,
  ...equivalence,
  ...variable,
  ...conversion,
  ...deductionExt,
  ...temporal,
  ...procedural,
  ...comparisonExt,
  ...meta,
} satisfies Record<string, RuleFn>;
