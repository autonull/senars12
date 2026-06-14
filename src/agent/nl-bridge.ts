import {NLUnderstandingService} from '../nar/nl/understanding.js';
import type {Ambiguity as UnderstandingAmbiguity} from '../nar/nl/understanding.js';
import {NLGenerationService, type GenerationInput} from '../nar/nl/generation.js';
import {ContextAssembler} from '../nar/nl/context-assembler.js';
import {TranslationCache} from '../nar/nl/cache.js';
import type {NAR} from '../nar/nar.js';
import type {SeNARSRegistry} from '../nar/lm/providers.js';
import {generateClarificationWithLM} from '../nar/nl/clarification.js';

export interface NlBridgeDeps {
    nar: NAR;
    registry: SeNARSRegistry;
}

export type NlTranslation =
    | {kind: 'result'; result: TranslationResult}
    | {kind: 'clarify'; question: string}
    | {kind: 'none'};

export interface NlBridge {
    nlToNarsese(nl: string): Promise<NlTranslation>;
    interpretDerivation(derivation: DerivationResult | null, query: string): Promise<string>;
    analyzeInput(nl: string): NLAnalysis;
    generateClarification(input: string): Promise<string>;
    isAvailable(): boolean;
}

export interface TranslationResult {
    beliefs: Array<{narsese: string; truth?: {f: number; c: number}}>;
    questions: string[];
    goals: string[];
    summary?: string;
}

export interface DerivationResult {
    steps: number;
    beliefs: Belief[];
    newBeliefs: Belief[];
    trace?: unknown[];
}

export interface Belief {
    term: string;
    truth?: {frequency: number; confidence: number};
}

export interface NLAnalysis {
    intent: 'chat' | 'command' | 'reasoning' | 'learning';
    entities: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    complexity: 'simple' | 'medium' | 'complex';
}

export function createNlBridge(deps: NlBridgeDeps): NlBridge {
    const cache = new TranslationCache();
    const understandingService = new NLUnderstandingService(deps.registry, cache, {structuredOnly: true});
    const generationService = new NLGenerationService(deps.registry);
    const contextAssembler = new ContextAssembler(cache);

    return {
        async nlToNarsese(nl: string): Promise<NlTranslation> {
            if (!deps.nar) return {kind: 'none'};

            const nlContext = contextAssembler.assemble(deps.nar, nl);
            const batch = await understandingService.understand(nl, nlContext);

            if (!batch) return {kind: 'none'};

            if (batch.meta.ambiguities.length > 0) {
                const firstAmbiguity = batch.meta.ambiguities[0];
                if (firstAmbiguity) {
                    const question = `I'm not sure about "${firstAmbiguity.description}". ${firstAmbiguity.options.join(' or ')}?`;
                    return {kind: 'clarify', question};
                }
            }

            const result: TranslationResult = {
                beliefs: batch.beliefs.map(b => ({narsese: b.narsese, truth: b.truth})),
                questions: batch.questions.map(q => q.narsese),
                goals: batch.goals.map(g => g.narsese),
                summary: `Understood: ${batch.meta.detectedIntent}`,
            };

            return {kind: 'result', result};
        },

        async interpretDerivation(derivation: DerivationResult | null, query: string): Promise<string> {
            if (!derivation || derivation.newBeliefs.length === 0) {
                return `I don't have enough information about "${query}".`;
            }

            const genInput: GenerationInput = {
                query,
                derivation: derivation.steps > 0 ? {
                    steps: derivation.steps,
                    beliefs: derivation.beliefs,
                    newBeliefs: derivation.newBeliefs,
                } : null,
                beliefs: derivation.beliefs,
                conflicts: [],
            };

            try {
                const output = await generationService.generate(genInput);
                return output.response;
            } catch {
                const best = derivation.newBeliefs[0];
                if (best) {
                    const truth = best.truth
                        ? ` (f=${best.truth.frequency.toFixed(2)}, c=${best.truth.confidence.toFixed(2)})`
                        : '';
                    return `Based on reasoning: ${best.term}${truth}`;
                }
                return `Based on reasoning about "${query}".`;
            }
        },

        analyzeInput(_nl: string): NLAnalysis {
            return {
                intent: 'chat',
                entities: [],
                sentiment: 'neutral',
                complexity: 'simple',
            };
        },

        async generateClarification(input: string): Promise<string> {
            const ambiguity: UnderstandingAmbiguity = {type: 'intent', description: input, options: ['clarify'], confidence: 0.5};
            const model = deps.registry.languageModel('cloud:quality') ?? deps.registry.languageModel('local:quality');
            if (!model) return `Could you clarify what you mean by "${input}"?`;
            const result = await generateClarificationWithLM(input, ambiguity, model);
            return result.question;
        },

        isAvailable(): boolean {
            return Boolean(deps.registry.languageModel('cloud:quality') ?? deps.registry.languageModel('local:quality'));
        },
    };
}