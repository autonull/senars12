import { type Truth as TruthType } from '../../terms/impls/Truth';
export type Desire = TruthType;
export declare const Desire: {
    /** f = desirability, c = confidence. Stored in goal bags only (Bench 3). */
    readonly create: (value: number, confidence: number) => Desire;
};
//# sourceMappingURL=desire.d.ts.map