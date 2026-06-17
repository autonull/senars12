import {generateObject, generateText} from 'ai';
import type {SeNARSRegistry} from '../lm/providers.js';
import {getStructuredModel} from '../lm/providers.js';
import {termParser} from '../terms/index.js';
import type {TranslationCache, TranslationCacheEntry} from './cache.js';
import {TaskBatchSchema} from './schemas.js';
import {buildUnderstandingPrompt} from './prompts/understanding-v1.js';

export interface Ambiguity {
    type: 'parse' | 'intent' | 'term' | 'reference';
    description: string;
    options: string[];
    confidence: number;
}

export interface Coreference {
    pronoun: string;
    antecedent: string;
    confidence: number;
}

export interface TaskBatch {
    beliefs: Array<{narsese: string; truth?: {f: number; c: number}; source: 'user' | 'inferred'}>;
    questions: Array<{narsese: string; context?: string}>;
    goals: Array<{narsese: string; priority?: number}>;
    meta: {
        detectedIntent: 'chat' | 'command' | 'reasoning' | 'learning';
        ambiguities: Ambiguity[];
        coreferences: Coreference[];
        implicitContext: string[];
        driveModulations?: Record<string, number>;
    };
}

export interface NLContext {
    beliefs?: string[];
    recentDerivations?: string[];
    memoryHealth?: {pressure: number; totalConcepts: number};
    activeGoals?: string[];
    recentExamples?: TranslationCacheEntry[];
}

function validateNarsese(text: string): boolean {
    if (!text) return false;
    const cleaned = text.replace(/^`+|`+$/g, '').trim();
    if (!cleaned) return false;
    try {
        termParser.parse(cleaned);
        return true;
    } catch {
        return false;
    }
}

export class NLUnderstandingService {
    private cache: TranslationCache;
    private structuredModel: ReturnType<typeof getStructuredModel>;
    private structuredOnly: boolean;

    constructor(
        registry: SeNARSRegistry,
        cache: TranslationCache,
        opts?: {structuredOnly?: boolean},
    ) {
        this.cache = cache;
        this.structuredModel = getStructuredModel(registry);
        this.structuredOnly = opts?.structuredOnly ?? true;
    }

    async understand(
        input: string,
        ctx?: NLContext,
        maxRetries = 2,
    ): Promise<TaskBatch | null> {
        const cached = this.cache.get(input);
        if (cached && typeof cached !== 'string') {
            return this.toTaskBatch(cached);
        }

        let lastError: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.translateWithLM(input, ctx, lastError);
                if (result) {
                    this.cache.record(input, {
                        beliefs: result.beliefs.map(b => ({narsese: b.narsese, truth: b.truth})),
                        questions: result.questions.map(q => q.narsese),
                        goals: result.goals.map(g => g.narsese),
                        summary: input,
                    });
                    return result;
                }
                lastError = 'No valid output produced';
            } catch (e) {
                lastError = e instanceof Error ? e.message : String(e);
            }
        }

        return null;
    }

    private async translateWithLM(
        input: string,
        ctx?: NLContext,
        lastError?: string | null,
    ): Promise<TaskBatch | null> {
        if (!this.structuredModel) return null;

        const prompt = buildUnderstandingPrompt(input, {
            beliefs: ctx?.beliefs,
            recentExamples: ctx?.recentExamples,
            lastError,
            memorySnapshot: ctx?.memoryHealth
                ? `Memory: ${ctx.memoryHealth.totalConcepts} concepts, pressure ${(ctx.memoryHealth.pressure * 100).toFixed(0)}%`
                : undefined,
        });

        // Fallback chain: generateObject → generateText+JSON.parse → raw Narsese heuristics
        let object: TaskBatch | null = null;

        // Level 1: generateObject (structured output)
        try {
            const result = await generateObject({
                model: this.structuredModel,
                prompt,
                schema: TaskBatchSchema,
            });
            object = result.object as TaskBatch;
        } catch {
            // Level 2: generateText + JSON.parse
            try {
                const textResult = await generateText({
                    model: this.structuredModel,
                    prompt: prompt + '\n\nRespond with valid JSON only.',
                });
                const jsonMatch = textResult.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    object = JSON.parse(jsonMatch[0]) as TaskBatch;
                }
            } catch {
                // Level 3: raw Narsese heuristics - extract Narsese from text
                try {
                    const textResult = await generateText({
                        model: this.structuredModel,
                        prompt: prompt + '\n\nRespond with Narsese statements only.',
                    });
                    object = this.extractNarseseFromText(textResult.text, input);
                } catch {
                    return null;
                }
            }
        }

        if (!object) return null;

        const validBeliefs = (object.beliefs ?? [])
            .filter(b => validateNarsese(b.narsese))
            .map(b => ({...b, source: b.source as 'user' | 'inferred'}));

        const validQuestions = (object.questions ?? []).filter(q => validateNarsese(q.narsese));
        const validGoals = (object.goals ?? []).filter(g => validateNarsese(g.narsese));

        if (validBeliefs.length === 0 && validQuestions.length === 0 && validGoals.length === 0) {
            return null;
        }

        return {
            beliefs: validBeliefs,
            questions: validQuestions,
            goals: validGoals,
            meta: {
                detectedIntent: object.meta?.detectedIntent as TaskBatch['meta']['detectedIntent'] ?? 'reasoning',
                ambiguities: object.meta?.ambiguities as unknown as Ambiguity[] ?? [],
                coreferences: object.meta?.coreferences as unknown as Coreference[] ?? [],
                implicitContext: object.meta?.implicitContext ?? [],
            },
        };
    }

    private extractNarseseFromText(text: string, input: string): TaskBatch {
        // Heuristic: extract valid Narsese from text response
        const beliefs: Array<{narsese: string; truth?: {f: number; c: number}; source: 'user' | 'inferred'}> = [];
        const questions: Array<{narsese: string; context?: string}> = [];
        const goals: Array<{narsese: string; priority?: number}> = [];

        // Look for Narsese patterns like (A --> B), (A => B), ?(A --> B), !(A)
        const narsesePattern = /[\(<][^\)>]*[\)>]/g;
        const matches = text.match(narsesePattern) ?? [];

        for (const match of matches) {
            if (validateNarsese(match)) {
                if (match.startsWith('?')) {
                    questions.push({narsese: match, context: input});
                } else if (match.startsWith('!')) {
                    goals.push({narsese: match, priority: 0.5});
                } else {
                    beliefs.push({narsese: match, source: 'user'});
                }
            }
        }

        return {
            beliefs,
            questions,
            goals,
            meta: {
                detectedIntent: 'learning',
                ambiguities: [],
                coreferences: [],
                implicitContext: [],
            },
        };
    }

    private toTaskBatch(result: {beliefs: Array<{narsese: string; truth?: {f: number; c: number}}>; questions: string[]; goals: string[]}): TaskBatch {
        return {
            beliefs: result.beliefs.map(b => ({...b, source: 'user' as const})),
            questions: result.questions.map(q => ({narsese: q})),
            goals: result.goals.map(g => ({narsese: g})),
            meta: {
                detectedIntent: 'reasoning',
                ambiguities: [],
                coreferences: [],
                implicitContext: [],
            },
        };
    }
}
