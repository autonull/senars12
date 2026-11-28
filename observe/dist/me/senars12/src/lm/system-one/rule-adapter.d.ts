import type { Term } from '../../terms';
import type { Task } from '../../types';
import type { CognitiveDispatcher } from './types';
export interface SystemOneLMRuleAdapterConfig {
    dispatcher: CognitiveDispatcher;
    nar: {
        getCycleCount: () => number;
        getSystemOneEmbeddingCache: () => any;
        getSystemOneManifold: () => any;
    };
    logger?: {
        debug?: (msg: string, meta?: any) => void;
        warn?: (msg: string, meta?: any) => void;
    };
}
export declare class SystemOneLMRuleAdapter {
    #private;
    constructor(config: SystemOneLMRuleAdapterConfig);
    translateToNarsese(input: string, context?: Record<string, unknown>): Promise<Task[]>;
    /**
     * REPLACE disposition (TODO16 §8, lm-meta-reasoning): continuous manifold
     * scoring over derivation traces. The top-ranked traces are re-admitted as
     * guidance beliefs; no generative LM call is made. Returns [] when there are
     * no traces to score (caller degrades silently — the symbolic fallback for
     * this rule is removed).
     */
    metaReason(_primary: Term, context?: Record<string, unknown>): Promise<Task[]>;
    /**
     * REPLACE disposition (TODO16 §8, lm-uncertainty-calibration): recalibrate a
     * belief's confidence through the fitted isotonic calibrators + drift
     * monitor. No generative call — always returns exactly one recalibrated
     * task; identity when no calibrator is fitted (calibration honesty, B5).
     */
    calibrateUncertainty(primary: Term, context?: Record<string, unknown>): Promise<Task[]>;
    /** F5: conflict-head verdict on a candidate derivation (ShadowValidator consumer). */
    conflictScore(candidateTerm: string): Promise<{
        score: number;
        fitted: boolean;
        abstained: boolean;
    } | null>;
    /** F5: novelty-head score for a concept (ProactiveEnricher budget gate). */
    noveltyScore(conceptTerm: string): Promise<{
        score: number;
        fitted: boolean;
        abstained: boolean;
    } | null>;
}
export declare function createSystemOneLMRuleAdapter(config: SystemOneLMRuleAdapterConfig): SystemOneLMRuleAdapter;
//# sourceMappingURL=rule-adapter.d.ts.map