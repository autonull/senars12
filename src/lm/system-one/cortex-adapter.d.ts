import type { ReasoningBudget } from '@senars/schemas';
import type { LMService } from '../lm-service';
import type { CognitiveContext, CortexHealth, GenerativeCortex, SynthesisProposition, SynthesisQuery } from './types';
export interface LMServiceCortexConfig {
    lmService: LMService;
    grammar?: string;
    temperature?: number;
    /** H2/X16: explicit model id binding (e.g. 'cloud:quality') for all Cortex calls. */
    model?: string;
}
export declare class LMServiceCortex implements GenerativeCortex {
    #private;
    constructor(config: LMServiceCortexConfig);
    /** Diagnostic introspection (Phase F, audit M4) — replaces private-name `?.` chains. */
    describe(): {
        grammar: string;
        temperature: number;
        model?: string;
    };
    /** Runtime tuning for the `.cortex model|grammar` CLI commands (audit M4). */
    setRuntimeTuning(tuning: {
        grammar?: string;
        model?: string;
    }): void;
    synthesize(context: CognitiveContext, query: SynthesisQuery, _budget: ReasoningBudget): AsyncGenerator<SynthesisProposition>;
    health(): CortexHealth;
    private buildPrompt;
    private parseCandidates;
}
export declare function createLMServiceCortex(config: LMServiceCortexConfig): GenerativeCortex;
//# sourceMappingURL=cortex-adapter.d.ts.map