import { Truth, type Truth as TruthType } from '../../terms/truth.js';

export type Desire = TruthType;

export const Desire = {
  /** f = desirability, c = confidence. Stored in goal bags only (Bench 3). */
  create: (value: number, confidence: number): Desire => Truth.create(value, confidence),
} as const;