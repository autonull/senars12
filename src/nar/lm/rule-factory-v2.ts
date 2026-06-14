/**
 * LM Rule Factory v2 - Typed, composable LM rules with categories
 *
 * Each rule is a typed, composable unit with:
 * - Input: primary Task + optional secondary + context
 * - Prompt: structured, versioned, testable
 * - Output: validated Task[] + confidence + metadata
 * - Categories: translation, explanation, hypothesis, analogy, schema, causal, meta
 */
import {z} from 'zod';
import type {Term} from '../terms';
import type {Task, TaskType} from '../types';
import {createTask} from '../types';
import type {LMClient} from './types.js';
import {LMResponseParser} from './parser.js';
import {CircuitBreaker} from '../utils';

export const LMCategory = z.enum([
    'translation',
    'explanation',
    'hypothesis',
    'analogy',
    'schema',
    'causal',
    'meta',
]);
export type LMCategory = z.infer<typeof LMCategory>;

export const ValidationResult = z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResult>;

export const LMContext = z.object({
    memorySnapshot: z.string().optional(),
    relatedBeliefs: z.array(z.string()).optional(),
    recentDerivations: z.array(z.string()).optional(),
    activeGoals: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
});
export type LMContext = z.infer<typeof LMContext>;

export interface LMRuleV2<In = unknown, Out = unknown> {
    id: string;
    category: LMCategory;
    inputSchema: z.ZodSchema<In>;
    outputSchema: z.ZodSchema<Out>;
    promptTemplate: (input: In, context: LMContext) => string;
    validate: (output: Out) => ValidationResult;
    priority: number;
    maxConcurrent: number;
    timeoutMs: number;
    taskType: TaskType;
    singlePremise?: boolean;
}

interface RuleStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    averageDuration: number;
}

export class LMRuleV2Runner<In = unknown, Out = unknown> {
    readonly id: string;
    readonly category: LMCategory;
    readonly priority: number;
    readonly sync = false as const;

    private enabled = true;
    private readonly lm: LMClient | null;
    private readonly rule: LMRuleV2<In, Out>;
    private readonly circuitBreaker: CircuitBreaker;
    private stats: RuleStats = {totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalDuration: 0, averageDuration: 0};

    constructor(rule: LMRuleV2<In, Out>, lm: LMClient | null) {
        this.id = rule.id;
        this.category = rule.category;
        this.priority = rule.priority;
        this.rule = rule;
        this.lm = lm;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            resetTimeoutMs: 60_000,
            halfOpenRequests: 3,
        });
    }

    canApply(primary: Term, secondary?: Term, _context?: Record<string, unknown>): boolean {
        if (!this.enabled || this.circuitBreaker.getState() === 'open' || !this.lm || !primary) return false;
        if (!this.rule.singlePremise && !secondary) return false;
        return true;
    }

    async apply(primary: Term, secondary?: Term, context?: Record<string, unknown>, signal?: AbortSignal): Promise<Task[]> {
        if (!this.canApply(primary, secondary, context) || signal?.aborted) return [];
        const startTime = Date.now();

        try {
            const input = {primary: primary.toString(), secondary: secondary?.toString(), context} as In;
            const lmContext: LMContext = {
                memorySnapshot: context?.memorySnapshot as string,
                relatedBeliefs: context?.relatedBeliefs as string[],
                recentDerivations: context?.recentDerivations as string[],
                activeGoals: context?.activeGoals as string[],
                confidence: context?.confidence as number,
            };
            const prompt = this.rule.promptTemplate(input, lmContext);

            const response = await this.circuitBreaker.execute(
                () => this.lm!.generateText(prompt, {signal}),
            );
            const duration = Date.now() - startTime;

            if (!response) {
                this.recordFailure(duration);
                return [];
            }

            const parsed = this.parseResponse(response);
            const validation = this.rule.validate(parsed);
            if (!validation.valid) {
                this.recordFailure(duration);
                return [];
            }

            const tasks = this.generateTasks(parsed, primary);
            this.recordSuccess(duration);
            return tasks;
        } catch (error) {
            const duration = Date.now() - startTime;
            if ((error as Error).name === 'AbortError') throw error;
            this.recordFailure(duration);
            return [];
        }
    }

    enable(): void { this.enabled = true; }
    disable(): void { this.enabled = false; }
    reset(): void { this.circuitBreaker.reset(); this.stats = {totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalDuration: 0, averageDuration: 0}; }

    getStats(): RuleStats & {circuitState: string} {
        return {...this.stats, circuitState: this.circuitBreaker.getState()};
    }

    private parseResponse(response: string): Out {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]) as Out;
        } catch {}
        return {response, confidence: 0.5} as Out;
    }

    private generateTasks(output: Out, primary: Term): Task[] {
        const obj = output as Record<string, unknown>;
        if (Array.isArray(obj?.tasks)) {
            return (obj.tasks as Array<{narsese: string; truth?: {f: number; c: number}}>).map(t => {
                const parsed = LMResponseParser.parse(t.narsese);
                return createTask(parsed.valid && parsed.term ? parsed.term : primary, this.rule.taskType, parsed.truth);
            });
        }
        const narsese = (obj?.narsese as string) ?? (obj?.response as string) ?? primary.toString();
        const parsed = LMResponseParser.parse(narsese);
        return [createTask(parsed.valid && parsed.term ? parsed.term : primary, this.rule.taskType, parsed.truth)];
    }

    private recordSuccess(duration: number): void {
        this.stats.totalCalls++;
        this.stats.successfulCalls++;
        this.stats.totalDuration += duration;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    }

    private recordFailure(duration: number): void {
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        this.stats.totalDuration += duration;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
    }
}

// --- Preset V2 Rules ---

export function createHypothesisRule(lm: LMClient | null): LMRuleV2Runner<{primary: string; context?: string}, {narsese: string; truth: {f: number; c: number}; rationale: string}> {
    return new LMRuleV2Runner({
        id: 'lm-v2-hypothesis',
        category: 'hypothesis',
        inputSchema: z.object({primary: z.string(), context: z.string().optional()}),
        outputSchema: z.object({
            narsese: z.string(),
            truth: z.object({f: z.number(), c: z.number()}),
            rationale: z.string(),
        }),
        promptTemplate: (input, ctx) => [
            'You are a NARS hypothesis generator.',
            ctx.relatedBeliefs?.length ? `Related beliefs: ${ctx.relatedBeliefs.join('; ')}` : '',
            `Given: ${input.primary}`,
            'Generate a plausible hypothesis in Narsese with truth values.',
            'Respond with JSON: {"narsese": "(...)", "truth": {"f": 0.8, "c": 0.7}, "rationale": "..."}',
        ].filter(Boolean).join('\n'),
        validate: (output) => ({
            valid: output.narsese.length > 0 && output.truth.f >= 0 && output.truth.f <= 1,
            errors: output.narsese.length === 0 ? ['Empty narsese'] : [],
        }),
        priority: 0.75,
        maxConcurrent: 2,
        timeoutMs: 30_000,
        taskType: 'belief',
    }, lm);
}

export function createExplanationRule(lm: LMClient | null): LMRuleV2Runner<{primary: string; derivationSteps?: number}, {explanation: string; confidence: number; keyPremises: string[]}> {
    return new LMRuleV2Runner({
        id: 'lm-v2-explanation',
        category: 'explanation',
        inputSchema: z.object({primary: z.string(), derivationSteps: z.number().optional()}),
        outputSchema: z.object({
            explanation: z.string(),
            confidence: z.number(),
            keyPremises: z.array(z.string()),
        }),
        promptTemplate: (input, ctx) => [
            'You are a NARS explanation generator.',
            ctx.relatedBeliefs?.length ? `Context beliefs: ${ctx.relatedBeliefs.join('; ')}` : '',
            `Explain why: ${input.primary}`,
            input.derivationSteps ? `Reasoning depth: ${input.derivationSteps} steps` : '',
            'Respond with JSON: {"explanation": "...", "confidence": 0.8, "keyPremises": ["..."]}',
        ].filter(Boolean).join('\n'),
        validate: (output) => ({
            valid: output.explanation.length > 0,
            errors: output.explanation.length === 0 ? ['Empty explanation'] : [],
        }),
        priority: 0.7,
        maxConcurrent: 2,
        timeoutMs: 30_000,
        taskType: 'belief',
        singlePremise: true,
    }, lm);
}

export function createAnalogyRule(lm: LMClient | null): LMRuleV2Runner<{primary: string; secondary: string}, {analogies: Array<{source: string; target: string; mapping: string}>}> {
    return new LMRuleV2Runner({
        id: 'lm-v2-analogy',
        category: 'analogy',
        inputSchema: z.object({primary: z.string(), secondary: z.string()}),
        outputSchema: z.object({
            analogies: z.array(z.object({
                source: z.string(),
                target: z.string(),
                mapping: z.string(),
            })),
        }),
        promptTemplate: (input) => [
            'You are an analogical reasoning system.',
            `Source: ${input.primary}`,
            `Target: ${input.secondary}`,
            'Find structural analogies between these concepts.',
            'Respond with JSON: {"analogies": [{"source": "...", "target": "...", "mapping": "..."}]}',
        ].join('\n'),
        validate: (output) => ({
            valid: output.analogies.length > 0,
            errors: output.analogies.length === 0 ? ['No analogies found'] : [],
        }),
        priority: 0.8,
        maxConcurrent: 1,
        timeoutMs: 30_000,
        taskType: 'belief',
    }, lm);
}

export function createCausalRule(lm: LMClient | null): LMRuleV2Runner<{primary: string; context?: string}, {relations: Array<{cause: string; effect: string; type: string; confidence: number}>}> {
    return new LMRuleV2Runner({
        id: 'lm-v2-causal',
        category: 'causal',
        inputSchema: z.object({primary: z.string(), context: z.string().optional()}),
        outputSchema: z.object({
            relations: z.array(z.object({
                cause: z.string(),
                effect: z.string(),
                type: z.string(),
                confidence: z.number(),
            })),
        }),
        promptTemplate: (input, ctx) => [
            'You are a causal reasoning system.',
            ctx.relatedBeliefs?.length ? `Known relations: ${ctx.relatedBeliefs.join('; ')}` : '',
            `Analyze causal relationships for: ${input.primary}`,
            'Respond with JSON: {"relations": [{"cause": "...", "effect": "...", "type": "direct|enabling|preventing", "confidence": 0.8}]}',
        ].filter(Boolean).join('\n'),
        validate: (_output) => ({
            valid: true,
            errors: [],
        }),
        priority: 0.8,
        maxConcurrent: 2,
        timeoutMs: 30_000,
        taskType: 'belief',
    }, lm);
}

export function createSchemaRule(lm: LMClient | null): LMRuleV2Runner<{primary: string; examples?: string[]}, {schema: string; instances: string[]; confidence: number}> {
    return new LMRuleV2Runner({
        id: 'lm-v2-schema',
        category: 'schema',
        inputSchema: z.object({primary: z.string(), examples: z.array(z.string()).optional()}),
        outputSchema: z.object({
            schema: z.string(),
            instances: z.array(z.string()),
            confidence: z.number(),
        }),
        promptTemplate: (input) => [
            'You are a schema induction system.',
            `Pattern: ${input.primary}`,
            input.examples?.length ? `Examples: ${input.examples.join('; ')}` : '',
            'Induce a reusable schema from this pattern.',
            'Respond with JSON: {"schema": "...", "instances": ["..."], "confidence": 0.8}',
        ].filter(Boolean).join('\n'),
        validate: (output) => ({
            valid: output.schema.length > 0,
            errors: output.schema.length === 0 ? ['Empty schema'] : [],
        }),
        priority: 0.75,
        maxConcurrent: 1,
        timeoutMs: 30_000,
        taskType: 'belief',
        singlePremise: true,
    }, lm);
}

// --- Factory ---

export function createV2Rules(lm: LMClient | null): LMRuleV2Runner<unknown, unknown>[] {
    return [
        createHypothesisRule(lm),
        createExplanationRule(lm),
        createAnalogyRule(lm),
        createCausalRule(lm),
        createSchemaRule(lm),
    ] as LMRuleV2Runner<unknown, unknown>[];
}
