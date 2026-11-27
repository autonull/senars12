import { Truth } from '../../terms/impls/Truth';
export const Desire = {
    /** f = desirability, c = confidence. Stored in goal bags only (Bench 3). */
    create: (value, confidence) => Truth.create(value, confidence),
};
