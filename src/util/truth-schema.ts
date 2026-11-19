import { z } from 'zod';

/** The `0..1` interval constraint used by truth schemas. */
const unitInterval = z.number().min(0).max(1);

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