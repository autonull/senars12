import type { GateRegistry } from '../kernel/index';
import type { Memory } from '../memory';
import type { Term } from '../terms';
import { Truth } from '../terms';
import { type Task } from '../types';
import type { LMService } from './lm-service';
import type { SystemOneLMRuleAdapter } from './system-one/rule-adapter';
/** F5: novelty-head budget gate (TODO16b: "novelty + budget pressure jointly trigger ProactiveEnricher"). */
export interface EnricherSystemOneDeps {
    adapter: SystemOneLMRuleAdapter;
    /** Enrich only concepts scoring at or above this on a *fitted* novelty head (unfitted ⇒ gate inactive). */
    minNovelty?: number;
}
export interface EnricherConfig {
    enableProactiveEnrichment: boolean;
    enrichmentIntervalMs: number;
    maxConceptsPerCycle: number;
    minConnectionsForEnrichment: number;
    enableExplanationGeneration: boolean;
    enableQAService: boolean;
}
export interface EnrichmentResult {
    concept: Term;
    hypotheses: Task[];
    bridges: Task[];
    explanations: string[];
}
export declare function parseEnrichmentResponse(response: string, defaultTruth?: Truth): {
    hypotheses: Task[];
    bridges: Task[];
};
export declare class ProactiveEnricher {
    private readonly gates;
    /** D17: bounded results. */
    static readonly RESULTS_CAP = 100;
    private readonly memory;
    private readonly lmService;
    private readonly config;
    private readonly logger;
    private readonly systemOne?;
    private stopEnrichmentTimer;
    private enrichmentCycle;
    private readonly results;
    constructor(memory: Memory, lmService: LMService, gates: GateRegistry, config?: Partial<EnricherConfig>, systemOne?: EnricherSystemOneDeps);
    start(): void;
    stop(): void;
    runEnrichmentCycle(): Promise<EnrichmentResult[]>;
    generateExplanation(derivationChain: Task[]): Promise<string>;
    answerQuestion(question: string, _context?: Task[]): Promise<string>;
    getEnrichmentHistory(): EnrichmentResult[];
    clearHistory(): void;
    getStats(): {
        enrichmentCycles: number;
        totalConceptsEnriched: number;
        totalHypothesesGenerated: number;
        totalBridgesCreated: number;
    };
    private enrichConcept;
    private buildHypothesisPrompt;
}
export declare const createProactiveEnricher: (memory: Memory, lmService: LMService, gates: GateRegistry, config?: Partial<EnricherConfig>, systemOne?: EnricherSystemOneDeps) => ProactiveEnricher;
//# sourceMappingURL=enrichment.d.ts.map