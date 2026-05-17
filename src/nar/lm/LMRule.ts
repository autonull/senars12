import type {Term} from '../terms';
import {Truth} from '../terms';
import type {Budget, Task, TaskType} from '../types';
import {createTask, EventBus} from '../types';
import type {LMClient, LMExecutionStats, LMRuleConfig, LMRuleStats} from './types.js';
import {CircuitBreaker, errMsg} from '../utils';
import type {Truth as TruthType} from '../terms/truth.js';
import {LMResponseParser} from './parser.js';
import {tryRepairAndParse} from './response-repair.js';

const defaultStats = (): LMExecutionStats => ({
    totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalDuration: 0,
    totalTokens: 0, averageDuration: 0, successRate: 0, totalCost: 0, averageCost: 0
});

export class LMRule {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly priority: number;
    readonly sync = false as const;

    private enabled: boolean;
    private readonly lm: LMClient | null;
    private config: LMRuleConfig;
    private circuitBreaker: CircuitBreaker;
    private eventBus: EventBus | null;
    private stats: LMExecutionStats = defaultStats();

    constructor(id: string, lm: LMClient | null, config: LMRuleConfig) {
        this.id = id;
        this.name = config.name ?? id;
        this.description = config.description ?? 'LM-based inference rule';
        this.priority = config.priority ?? 1.0;
        this.enabled = config.enabled ?? true;
        this.lm = lm;
        this.config = config;
        this.circuitBreaker = new CircuitBreaker({failureThreshold: 5, resetTimeoutMs: 60000, halfOpenRequests: 3});
        this.eventBus = null;
    }

    setEventBus(eventBus: EventBus): void {
        this.eventBus = eventBus;
    }

    canApply(primary: Term, secondary?: Term, _context?: Record<string, unknown>): boolean {
        return this.enabled && this.circuitBreaker.getState() !== 'open' && !!this.lm && !!primary && (!this.config.singlePremise || !!secondary);
    }

    async apply(primary: Term, secondary?: Term, context?: Record<string, unknown>): Promise<Task[]> {
        if (!this.canApply(primary, secondary, context)) return [];

        const startTime = Date.now();

        try {
            const prompt = this.generatePrompt(primary, secondary, context);
            this.emitEvent('lm.prompt', {ruleId: this.id, prompt, timestamp: Date.now()});

            const response = await this.executeLM(prompt);
            this.emitEvent('lm.response', {
                ruleId: this.id,
                prompt,
                response,
                duration: Date.now() - startTime,
                timestamp: Date.now()
            });

            if (!response) {
                this.recordExecution(false, Date.now() - startTime);
                return [];
            }

            const processed = this.processResponse(response, primary, secondary, context);
            const tasks = this.generateTasks(processed, primary, secondary, context);
            this.recordExecution(true, Date.now() - startTime, prompt.length + response.length);
            return tasks;
        } catch (error) {
            this.emitEvent('lm.failure', {
                ruleId: this.id,
                error: errMsg(error),
                duration: Date.now() - startTime,
                timestamp: Date.now()
            });
            this.recordExecution(false, Date.now() - startTime);
            return [];
        }
    }

    getStats(): LMRuleStats {
        return {
            id: this.id,
            name: this.name,
            enabled: this.enabled,
            stats: this.stats,
            circuitState: this.circuitBreaker.getState() as 'closed' | 'open' | 'half-open'
        };
    }

    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    reset(): void {
        this.circuitBreaker.reset();
        this.stats = defaultStats();
    }

    private emitEvent(eventName: string, data: unknown): void {
        if (this.eventBus) this.eventBus.emit(eventName, data);
    }

    private async executeLM(prompt: string): Promise<string> {
        if (!this.lm) throw new Error(`LM unavailable for rule ${this.id}`);
        return await this.circuitBreaker.execute(async () => await this.lm!.generateText(prompt, this.config.lmOptions));
    }

    private generatePrompt(primary: Term, secondary: Term | undefined, context?: Record<string, unknown>): string {
        const template = this.config.promptTemplate;
        if (typeof template === 'string') return this.fillTemplate(template, primary, secondary);
        if (typeof template === 'function') return template(primary, secondary, context);
        return `Reason about: ${primary.toString()}`;
    }

    private fillTemplate(template: string, primary: Term, secondary?: Term): string {
        return template.replace('{{primaryTerm}}', primary.toString()).replace('{{secondaryTerm}}', secondary?.toString() ?? '');
    }

    private processResponse(response: string, primary: Term, secondary: Term | undefined, context?: Record<string, unknown>): unknown {
        const repaired = tryRepairAndParse(response, (r) => r, 'narsese') ?? response;
        return this.config.responseProcessor ? this.config.responseProcessor(repaired, primary, secondary, context) : repaired;
    }

    private generateTasks(processed: unknown, primary: Term, secondary: Term | undefined, context?: Record<string, unknown>): Task[] {
        if (this.config.taskGenerator) return this.config.taskGenerator(processed, primary, secondary, context);
        if (Array.isArray(processed)) return processed.map(p => this.taskFromProcessed(p, primary));
        return [this.taskFromProcessed(processed, primary)];
    }

    private taskFromProcessed(processed: unknown, primary: Term): Task {
        if (typeof processed === 'string') {
            const parsed = LMResponseParser.parse(processed);
            if (parsed.valid && parsed.term) {
                return createTask(parsed.term, 'belief', parsed.truth ?? Truth.NEUTRAL,
                    parsed.confidence != null ? {
                        priority: parsed.confidence,
                        durability: 0.8,
                        quality: 0.9,
                        cycles: 0,
                        depth: 0
                    } : undefined);
            }
        }

        const term = (processed as Partial<Task> & { term?: Term }).term ?? primary;
        const type = (processed as Partial<Task> & { type?: TaskType }).type ?? 'belief';
        const truth = (processed as Partial<Task> & { truth?: TruthType }).truth ?? Truth.NEUTRAL;
        const budget = (processed as Partial<Task> & { budget?: Budget }).budget;

        return createTask(term, type, truth, budget ?? undefined);
    }

    private recordExecution(success: boolean, duration: number, tokens?: number): void {
        this.stats.totalCalls++;
        this.stats.successfulCalls += success ? 1 : 0;
        this.stats.failedCalls += success ? 0 : 1;
        this.stats.totalDuration += duration;
        this.stats.totalTokens += tokens ?? 0;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalCalls;
        this.stats.successRate = this.stats.successfulCalls / this.stats.totalCalls;
    }
}
