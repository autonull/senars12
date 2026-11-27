import type { GateRegistry } from '../kernel/index';
import type { Memory } from '../memory';
import { Truth } from '../terms';
import { type Task } from '../types';
import type { LMService } from './lm-service';
export interface FeedbackConfig {
    enableBidirectionalFeedback: boolean;
    enableValidation: boolean;
    enableContextEnrichment: boolean;
    enableContradictionExplanation: boolean;
    enablePatternExtraction: boolean;
    maxContextConcepts: number;
    minConfidenceForFeedback: number;
    maxContradictionAttempts: number;
}
export interface ValidationFeedback {
    originalHypothesis: Task;
    validationResult: 'confirmed' | 'contradicted' | 'inconclusive';
    evidence: Task[];
    revisedTruth?: Truth;
    derivationChain: string[];
    explanation?: string;
    novelty?: number;
    utility?: number;
}
export interface ContradictionExplanation {
    beliefA: Task;
    beliefB: Task;
    explanation: string;
    revisedBelief?: Task;
    resolutionStrategy: 'merge' | 'reject-one' | 'keep-both' | 'revise';
}
export interface ExtractedPattern {
    pattern: string;
    confidence: number;
    examples: string[];
    type: string;
}
export declare class BidirectionalFeedbackLoop {
    private readonly gates;
    private readonly memory;
    private readonly lmService;
    private readonly config;
    private readonly logger;
    private pendingValidations;
    private readonly recentPatterns;
    private recordPatterns;
    constructor(memory: Memory, lmService: LMService, gates: GateRegistry, config?: Partial<FeedbackConfig>);
    /**
     * The one structured-output ladder, which is why each site below says only
     * `generateObject`: `LMService.generateObject` already retries structured
     * output as a JSON-mode text round trip when a provider's native path fails,
     * so the `catch → generateText → reparse` arm each of these three sites
     * spelled out was a third layer over it — a weaker parser, and an extra
     * provider call on every failure. What is left to express is the last resort
     * only validation has: reading a verdict out of prose.
     *
     * The try covers the call and nothing else. Before, a throw from a local
     * transform on the way out was caught here and answered with a second LM call
     * through a different parser.
     */
    private structured;
    /** The prose last resort: read a verdict out of a reply that ignored the schema. */
    private legacyValidation;
    processHypothesis(hypothesis: Task): Promise<ValidationFeedback | null>;
    private applyValidation;
    private reviseTruth;
    explainContradiction(beliefA: Task, beliefB: Task): Promise<ContradictionExplanation | null>;
    private applyContradiction;
    extractPatterns(derivations: Task[]): Promise<ExtractedPattern[]>;
    private applyPatterns;
    enrichContextWithDerivations(derivations: Task[]): Promise<void>;
    getPendingValidations(): ValidationFeedback[];
    getRecentPatterns(): ExtractedPattern[];
    clearPendingValidations(): void;
    private getContextBeliefs;
    private buildStructuredValidationPrompt;
    private parseLegacyValidation;
    private injectValidationResult;
    private buildEnrichmentPrompt;
}
export declare const createBidirectionalFeedbackLoop: (memory: Memory, lmService: LMService, gates: GateRegistry, config?: Partial<FeedbackConfig>) => BidirectionalFeedbackLoop;
//# sourceMappingURL=feedback.d.ts.map