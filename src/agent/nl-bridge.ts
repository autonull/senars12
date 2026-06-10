import {NLTranslator, type TranslationResult} from '../nar/nl/translator.js';
import {ResultInterpreter, type DerivationResult} from '../nar/nl/interpreter.js';
import {NLAnalyzer, type NLAnalysis} from '../nar/nl/analyzer.js';
import {generateClarificationWithLM} from '../nar/nl/clarification.js';
import type {NAR} from '../nar/nar.js';
import type {SeNARSRegistry} from '../nar/lm/providers.js';

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
    interpretDerivation(derivation: DerivationResult | null, query: string): string;
    analyzeInput(nl: string): ReturnType<NLAnalyzer['analyze']>;
    generateClarification(input: string): Promise<string>;
    isAvailable(): boolean;
}

export function createNlBridge(deps: NlBridgeDeps): NlBridge {
    const translator = new NLTranslator(deps.registry, {structuredOnly: true});
    const interpreter = new ResultInterpreter();
    const analyzer = new NLAnalyzer();

    return {
        async nlToNarsese(nl: string): Promise<NlTranslation> {
            const raw = await translator.translate(nl);
            if (raw === null) return {kind: 'none'};
            if (typeof raw === 'string') return {kind: 'clarify', question: raw};
            return {kind: 'result', result: raw};
        },

        interpretDerivation(derivation: DerivationResult | null, query: string): string {
            return interpreter.interpret(derivation, query, deps.nar);
        },

        analyzeInput(nl: string): NLAnalysis {
            return analyzer.analyze(nl);
        },

        async generateClarification(input: string): Promise<string> {
            const ambiguity = {type: 'intent' as const, options: ['clarify'], confidence: 0.5};
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

export type {TranslationResult, DerivationResult};
