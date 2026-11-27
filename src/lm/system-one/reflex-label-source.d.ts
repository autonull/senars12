import { type JudgmentDataset } from './distill';
export interface ReflexOutcomeInput {
    stateDigest: string;
    action: string;
    reward: number;
    source: string;
    /** Optional 384-d state embedding for inline vector storage (redaction-safe). */
    embedding?: Float32Array;
}
/**
 * RL outcome label source (C4/R4): pipes (state, action, reward) outcomes into
 * the JudgmentDataset so `reflex_value` heads can be trained from play.
 * Redaction-per-retention — only the state-digest hash is stored, never raw text.
 */
export declare function recordReflexOutcome(dataset: JudgmentDataset, input: ReflexOutcomeInput): void;
//# sourceMappingURL=reflex-label-source.d.ts.map