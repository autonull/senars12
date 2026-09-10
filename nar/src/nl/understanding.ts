import type {LanguageModel} from 'ai';
import {generateObject, generateText, zodSchema} from 'ai';
import type {ZodSchema} from 'zod';
import type {SeNARSRegistry} from '../lm';
import {getModelForTask} from '../lm';
import {errMsg} from '../utils';
import {termParser} from '../terms/index.js';
import {SymbolicFirewall, type FirewallOptions} from './firewall.js';
import type {TranslationCache, TranslationCacheEntry} from './cache.js';
import {buildUnderstandingPrompt} from './prompts/understanding-v1.js';
import {TaskBatchSchema} from './schemas.js';
import {v4 as uuidv4} from 'uuid';
import type {AmbiguityFlag, FormalizationBatch, FormalizationCandidate} from '@senars/kernel/schemas';
import {validateFormalizationBatch} from '@senars/kernel/schemas';

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
    beliefs: Array<{
        narsese: string;
        truth?: { f: number; c: number };
        source: 'user' | 'inferred';
    }>;
    questions: Array<{ narsese: string; context?: string }>;
    goals: Array<{ narsese: string; priority?: number }>;
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
    memoryHealth?: { pressure: number; totalConcepts: number };
    activeGoals?: string[];
    recentExamples?: TranslationCacheEntry[];
}

function validateNarsese(text: string): boolean {
    if (!text) return false;
    const cleaned = text.replace(/^`+|`+$/g, '').trim();
    if (!cleaned) return false;
    try {
        termParser.parse(cleaned.replace(/[.?!]$/, ''));
        return true;
    } catch {
        return false;
    }
}

export class NLUnderstandingService {
    private readonly model: LanguageModel;
    private structuredOnly: boolean;
    private readonly firewall: SymbolicFirewall;

    constructor(
        registry: SeNARSRegistry,
        _cache: TranslationCache,
        opts?: { structuredOnly?: boolean; firewall?: FirewallOptions | SymbolicFirewall }
    ) {
        this.model = getModelForTask(registry, 'structured') as LanguageModel;
        this.structuredOnly = opts?.structuredOnly ?? true;
        this.firewall = opts?.firewall instanceof SymbolicFirewall ? opts.firewall : new SymbolicFirewall(opts?.firewall ?? {});
    }

    async understand(input: string, ctx?: NLContext, maxRetries = 2): Promise<TaskBatch | null> {
        let lastError: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.translateWithLM(input, ctx, lastError);
                if (result) {
                    return this.sanitize(result);
                }
                lastError = 'No valid output produced';
            } catch (e) {
                lastError = errMsg(e);
            }
        }

        return null;
    }

    async understandCandidates(input: string, ctx?: NLContext): Promise<FormalizationBatch | null> {
        const batch = await this.understand(input, ctx);
        if (!batch) return null;
        return toFormalizationBatch(input, batch);
    }

    sanitize(batch: TaskBatch): TaskBatch {
        return {
            ...batch,
            beliefs: batch.beliefs
                .filter((b) => this.firewall.check(b.narsese, 'belief').allowed)
                .map((b) => b.truth && b.source === 'inferred'
                    ? {...b, truth: {...b.truth, c: this.firewall.clampConfidence(b.truth.c)}}
                    : b),
            questions: batch.questions.filter((q) => this.firewall.check(q.narsese, 'question').allowed),
            goals: batch.goals.filter((g) => this.firewall.check(g.narsese, 'goal').allowed),
        };
    }

    private async translateWithLM(
        input: string,
        ctx?: NLContext,
        lastError?: string | null
    ): Promise<TaskBatch | null> {
        if (!this.model) return null;

        const prompt = buildUnderstandingPrompt(input, {
            beliefs: ctx?.beliefs,
            recentExamples: ctx?.recentExamples,
            lastError,
            memorySnapshot: ctx?.memoryHealth
                ? `Memory: ${ctx.memoryHealth.totalConcepts} concepts, pressure ${(ctx.memoryHealth.pressure * 100).toFixed(0)}%`
                : undefined,
        });

        try {
            const result = await generateObject({
                model: this.model,
                prompt,
                schema: zodSchema(TaskBatchSchema as ZodSchema<TaskBatch>),
            });
            return result.object as TaskBatch;
        } catch {
            try {
                const textResult = await generateText({
                    model: this.model,
                    prompt: prompt + '\n\nRespond with valid JSON only.',
                });
                const jsonMatch = textResult.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]) as TaskBatch;
                }
            } catch {
                try {
                    const textResult = await generateText({
                        model: this.model,
                        prompt: prompt + '\n\nRespond with Narsese statements only.',
                    });
                    return this.extractNarseseFromText(textResult.text, input);
                } catch {
                    return null;
                }
            }
        }

        return null;
    }

    private extractNarseseFromText(text: string, input: string): TaskBatch {
        const beliefs: Array<{
            narsese: string;
            truth?: { f: number; c: number };
            source: 'user' | 'inferred';
        }> = [];
        const questions: Array<{ narsese: string; context?: string }> = [];
        const goals: Array<{ narsese: string; priority?: number }> = [];

        const narsesePattern = /[(<][^)>]*[)>]/g;
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
}

const MODAL_RE = /\b(may|might|must|should|can|could|would|likely|probably)\b/i;
const NEGATION_RE = /\b(unless|not|no\b|never|n't\b|without|except)\b/i;
const QUANTIFIER_RE = /\b(all|every|each|some|most|few|any|none)\b/i;
const TEMPORAL_RE = /\b(when|while|after|before|until|during|always|sometimes)\b/i;

export function detectAmbiguityFlags(input: string): AmbiguityFlag[] {
    const flags: AmbiguityFlag[] = [];
    if (NEGATION_RE.test(input)) flags.push({type: 'negation', description: 'Negation or exception ("unless", "not", "never") — scope is uncertain', options: ['narrow-scope', 'wide-scope'], confidence: 0.6, severity: 'high'});
    if (MODAL_RE.test(input)) flags.push({type: 'modal', description: 'Modal qualifier ("may", "must", "should") — strength is uncertain', options: ['strong', 'weak'], confidence: 0.6, severity: 'medium'});
    if (QUANTIFIER_RE.test(input)) flags.push({type: 'quantifier', description: 'Quantifier ("all", "some", "most") — universality is uncertain', options: ['universal', 'existential'], confidence: 0.55, severity: 'medium'});
    if (TEMPORAL_RE.test(input)) flags.push({type: 'temporal', description: 'Temporal marker ("when", "after", "until") — ordering is uncertain', options: ['sequence', 'implication'], confidence: 0.5, severity: 'low'});
    return flags;
}

export function toFormalizationBatch(input: string, batch: TaskBatch): FormalizationBatch {
    const span = {start: 0, end: input.length, text: input};
    const candidates: FormalizationCandidate[] = [
        ...batch.beliefs.map((b): FormalizationCandidate => ({
            candidateId: uuidv4(),
            narsese: b.narsese,
            taskType: 'belief',
            ...(b.truth ? {truth: {frequency: b.truth.f, confidence: b.truth.c}} : {}),
            confidence: b.truth?.c ?? (b.source === 'user' ? 0.7 : 0.5),
            sourceSpans: [span],
            ambiguityFlags: detectAmbiguityFlags(input),
        })),
        ...batch.questions.map((q): FormalizationCandidate => ({
            candidateId: uuidv4(),
            narsese: q.narsese,
            taskType: 'question',
            confidence: 0.6,
            sourceSpans: [span],
            ambiguityFlags: detectAmbiguityFlags(input),
        })),
        ...batch.goals.map((g): FormalizationCandidate => ({
            candidateId: uuidv4(),
            narsese: g.narsese,
            taskType: 'goal',
            confidence: g.priority ?? 0.5,
            sourceSpans: [span],
            ambiguityFlags: detectAmbiguityFlags(input),
        })),
    ];
    return validateFormalizationBatch({
        batchId: uuidv4(),
        sourceText: input,
        candidates,
        detectedIntent: batch.meta.detectedIntent,
        globalAmbiguities: batch.meta.ambiguities.map((a) => ({
            type: a.type,
            description: a.description,
            options: a.options,
            confidence: a.confidence,
            severity: 'medium' as const,
        })),
    });
}
