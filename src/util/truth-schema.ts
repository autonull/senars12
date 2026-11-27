import { z } from 'zod';
import { unitInterval } from '../config/boundary';

/** The `0..1` truth pair every event payload, derivation record, and formalization candidate carries. */
export const BeliefTruthSchema = z.object({
  frequency: unitInterval,
  confidence: unitInterval,
});

/** The `{ f, c }` truth shape the engine speaks internally. */
export const TermTruthSchema = z.object({
  f: unitInterval,
  c: unitInterval,
});