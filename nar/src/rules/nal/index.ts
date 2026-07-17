/**
 * NALRules — consolidated map of core NAL inference rules.
 */
import type { RuleFn } from '../types.js';
import * as core from './core.js';
import * as logic from './logic.js';
import * as propositional from './propositional.js';
import * as higherOrder from './higher-order.js';
import * as comparison from './comparison.js';

export const NALRules = {
  ...core,
  ...logic,
  ...propositional,
  ...higherOrder,
  ...comparison,
} satisfies Record<string, RuleFn>;
