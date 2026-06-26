import {generateObject, generateText} from 'ai';
import type {SeNARSRegistry} from '../lm';
import {getStructuredModel} from '../lm';
import {GenerationOutputSchema} from './schemas.js';
import {buildGenerationPrompt} from './prompts/generation-v1.js';

export interface BeliefInfo {
    term: string;
    truth?: { frequency: number; confidence: number };
}

export interface DerivationTrace {
    steps: number;
    beliefs: BeliefInfo[];
    newBeliefs: BeliefInfo[];
}

export interface ConflictInfo {
    belief: BeliefInfo;
    conflictWith: BeliefInfo;
    type: 'direct' | 'frequency' | 'implication';
}

export interface GenerationInput {
    query: string;
    derivation: DerivationTrace | null;
    beliefs: BeliefInfo[];
    conflicts: ConflictInfo[];
    userProfile?: { expertise: 'lay' | 'technical'; verbosity: 'concise' | 'detailed' };
}

export interface GenerationOutput {
    response: string;
    confidence: number;
    suggestedFollowups: string[];
    meta: {
        reasoningType: string;
        keyPremises: string[];
        gaps: string[];
    };
}

function classifyReasoning(derivation: DerivationTrace | null): string {
    if (!derivation || derivation.steps === 0) return 'direct observation';
    if (derivation.steps <= 2) return 'simple deduction';
    if (derivation.steps <= 5) return 'multi-step reasoning';
    return 'deep reasoning';
}

function findKnowledgeGaps(beliefs: BeliefInfo[]): string[] {
    const gaps: string[] = [];
    for (const b of beliefs) {
        if (b.truth && b.truth.confidence < 0.6) {
            gaps.push(`more evidence about ${b.term}`);
        }
    }
    return Array.from(new Set(gaps)).slice(0, 3);
}

export class NLGenerationService {
    private readonly structuredModel: ReturnType<typeof getStructuredModel>;

    constructor(registry: SeNARSRegistry) {
        this.structuredModel = getStructuredModel(registry);
    }

    async generate(input: GenerationInput): Promise<GenerationOutput> {
        if (!this.structuredModel) {
            return this.fallbackGenerate(input);
        }

        const derivation = input.derivation;
        const reasoningType = classifyReasoning(derivation);
        const keyPremises = derivation?.newBeliefs.slice(0, 3).map(b => b.term) ?? [];
        const gaps = findKnowledgeGaps(input.beliefs);

        const prompt = buildGenerationPrompt({
            query: input.query,
            beliefs: derivation?.newBeliefs ?? input.beliefs,
            conflicts: input.conflicts,
            derivationSteps: derivation?.steps,
            reasoningType,
            keyPremises,
            gaps,
            userProfile: input.userProfile,
        });

        // Fallback chain: generateObject → generateText+regex → template fallback
        try {
            const {object} = await generateObject({
                model: this.structuredModel,
                prompt,
                schema: GenerationOutputSchema,
            });

            return {
                response: object.response,
                confidence: object.confidence,
                suggestedFollowups: object.suggestedFollowups,
                meta: {
                    reasoningType: object.meta.reasoningType || reasoningType,
                    keyPremises: object.meta.keyPremises.length > 0 ? object.meta.keyPremises : keyPremises,
                    gaps: object.meta.gaps.length > 0 ? object.meta.gaps : gaps,
                },
            };
        } catch {
            // Level 2: generateText + regex extraction
            try {
                const textResult = await generateText({
                    model: this.structuredModel,
                    prompt: prompt + '\n\nRespond with a natural language answer, confidence (0-1), and followup questions as JSON: {"response": "...", "confidence": 0.8, "suggestedFollowups": ["..."]}',
                });
                const jsonMatch = textResult.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        response: parsed.response ?? '',
                        confidence: parsed.confidence ?? 0.5,
                        suggestedFollowups: parsed.suggestedFollowups ?? [],
                        meta: {reasoningType, keyPremises, gaps},
                    };
                }
            } catch {
                // Level 3: template fallback
            }
            return this.fallbackGenerate(input);
        }
    }

    private fallbackGenerate(input: GenerationInput): GenerationOutput {
        const derivation = input.derivation;
        if (!derivation || derivation.newBeliefs.length === 0) {
            return {
                response: `I don't have enough information about "${input.query}".`,
                confidence: 0.2,
                suggestedFollowups: [],
                meta: {
                    reasoningType: 'no derivation',
                    keyPremises: [],
                    gaps: [`knowledge about ${input.query}`],
                },
            };
        }

        const best = derivation.newBeliefs[0]!;
        const truth = best.truth
            ? ` (f=${best.truth.frequency.toFixed(2)}, c=${best.truth.confidence.toFixed(2)})`
            : '';

        return {
            response: `Based on reasoning: ${best.term}${truth}`,
            confidence: best.truth?.confidence ?? 0.5,
            suggestedFollowups: [],
            meta: {
                reasoningType: classifyReasoning(derivation),
                keyPremises: derivation.newBeliefs.slice(0, 3).map(b => b.term),
                gaps: findKnowledgeGaps(input.beliefs),
            },
        };
    }
}
