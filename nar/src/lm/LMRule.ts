import { generateObject, type LanguageModel, zodSchema } from 'ai';
import type { ZodSchema } from 'zod';
import type { Term } from '../terms';
import { Truth, termParser } from '../terms';
import type { Truth as TruthType } from '../terms/truth.js';
import type { Budget, Task, TaskType } from '../types';
import { createTask, type NAREventMap, type EventBus as NarEventBus } from '../types';
import { CircuitBreaker, errMsg } from '../utils';
import type { LMExecutionStats, LMRuleConfig, LMRuleStats, LMService } from './lm-service.js';
import { createLMStats, recordLMCall } from './stats.js';

export interface LMContext {
  memorySnapshot?: string;
  relatedBeliefs?: string[];
  recentDerivations?: string[];
  activeGoals?: string[];
  confidence?: number;
  conceptPriority?: number;
  taskTerm?: string;
  secondaryTerm?: string;
  taskType?: string;
  driveState?: Record<string, number>;
  conflictCount?: number;
  memoryPressure?: number;
  totalConcepts?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface LMRuleConfigV2<In = unknown, Out = unknown>
  extends Omit<LMRuleConfig, 'promptTemplate'> {
  inputSchema?: ZodSchema<In>;
  outputSchema?: ZodSchema<Out>;
  validate?: (output: Out) => ValidationResult;
  promptTemplate?: string | ((input: In, context: LMContext) => string);
  promptVersion?: 1 | 2;
  taskType?: TaskType;
  schema?: ZodSchema;
  enableTools?: boolean;
  constitutionAware?: boolean;
}

export class LMRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly priority: number;
  readonly sync = false as const;
  readonly taskType: TaskType;

  private enabled: boolean;
  private readonly lm: LMService | null;
  private readonly baseConfig: LMRuleConfig;
  private readonly v2Config: LMRuleConfigV2;
  private readonly circuitBreaker: CircuitBreaker;
  private eventBus: NarEventBus | null;
  private systemEventBus: NarEventBus | null = null;
  private stats: LMExecutionStats = createLMStats();
  private structuredModel: LanguageModel | null = null;
  private toolDispatcher?: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  private readonly enableTools: boolean;
  private readonly constitutionAware: boolean;
  private nar?: { 
    checkConstitutionViolation(task: Task): boolean; 
    getConstitution(): Task[];
    getSystemOneDispatcher?(): { 
      proposeAndJudge(
        context: any,
        synthesisQuery: any,
        judgmentQueries: readonly any[],
        budget: any
      ): Promise<any>;
    } | undefined;
  };
  private systemOneAdapter?: { translateToNarsese(input: string, context?: Record<string, unknown>): Promise<Task[]> };
  private readonly outputSchema?: ZodSchema;
  private readonly inputSchema?: ZodSchema;
  private readonly validateFn?: (output: unknown) => ValidationResult;
  private readonly v2PromptFn?: (input: unknown, context: LMContext) => string;

  constructor(id: string, lm: LMService | null, config: LMRuleConfig | LMRuleConfigV2 = {}) {
    const v2 = config as LMRuleConfigV2;
    this.id = id;
    this.name = config.name ?? id;
    this.description = config.description ?? 'LM-based inference rule';
    this.category = config.category ?? 'general';
    this.priority = config.priority ?? 1.0;
    this.taskType = v2.taskType ?? 'belief';
    this.enabled = config.enabled ?? true;
    this.lm = lm;
    this.v2Config = v2;
    this.baseConfig = config as LMRuleConfig;
    this.outputSchema = v2.outputSchema;
    this.inputSchema = v2.inputSchema;
    this.validateFn = v2.validate as ((output: unknown) => ValidationResult) | undefined;
    this.constitutionAware = v2.constitutionAware ?? false;
    const tpl = config.promptTemplate;
    if (
      typeof tpl === 'function' &&
      (v2.promptVersion === 2 || (v2.promptVersion !== 1 && (v2.inputSchema || v2.outputSchema)))
    ) {
      this.v2PromptFn = tpl as (input: unknown, context: LMContext) => string;
    }
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRequests: 3,
      quiet: true,
    });
    this.eventBus = null;
    this.enableTools = v2.enableTools ?? false;
  }

  setEventBus(eventBus: NarEventBus): void {
    this.eventBus = eventBus;
  }

  setSystemEventBus(bus: NarEventBus): void {
    this.systemEventBus = bus;
  }

  setStructuredModel(model: LanguageModel): void {
    this.structuredModel = model;
  }

  setNAR(nar: {
    checkConstitutionViolation(task: Task): boolean;
    getConstitution(): Task[];
  }): void {
    this.nar = nar;
  }

  setToolDispatcher(
    dispatcher: (tool: string, args: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.toolDispatcher = dispatcher;
  }

  setSystemOneAdapter(adapter: { translateToNarsese(input: string, context?: Record<string, unknown>): Promise<Task[]> }): void {
    this.systemOneAdapter = adapter;
  }

  canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean {
    return !this.getSkipReason(primary, secondary, context);
  }

  async apply(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Task[]> {
    const skipReason = this.getSkipReason(primary, secondary, context);
    if (skipReason || signal?.aborted) {
      if (skipReason)
        this.emitSystemEvent('system:lm.rule:skipped', {
          ruleId: this.id,
          ruleName: this.name,
          reason: skipReason,
          timestamp: Date.now(),
        });
      return [];
    }

    // Use System One adapter for translation rule when available
    if (this.id === 'lm-narsese-translation' && this.systemOneAdapter) {
      try {
        const tasks = await this.systemOneAdapter.translateToNarsese(primary.toString(), context);
        if (tasks.length > 0) {
          this.emitSystemEvent('system:lm.rule:applied', {
            ruleId: this.id,
            ruleName: this.name,
            primaryTerm: primary.toString(),
            secondaryTerm: secondary?.toString(),
            tasksProduced: tasks.length,
            durationMs: 0,
            timestamp: Date.now(),
            schema: 'system-one',
          });
          return tasks;
        }
      } catch (e) {
        // Fall through to LM-based translation on adapter failure
        this.emitEvent('lm.failure', {
          ruleId: this.id,
          error: `System One adapter failed: ${e}`,
          duration: 0,
          timestamp: Date.now(),
        });
      }
    }

    const startTime = Date.now();

    try {
      const lmContext = this.buildLMContext(primary, secondary, context);
      const prompt = this.generatePrompt(primary, secondary, lmContext, context);
      this.emitEvent('lm.prompt', {
        ruleId: this.id,
        ruleName: this.name,
        prompt,
        timestamp: Date.now(),
      });

      let response: string | null;
      const usedStructured = !!(this.structuredModel && this.outputSchema);
      if (usedStructured) {
        response = await this.executeStructured(prompt, signal);
      } else {
        response = await this.executeLM(prompt, signal);
      }

      if (!response) {
        this.recordFailure(Date.now() - startTime);
        return this.applyFallback(primary, secondary, context);
      }

      if (usedStructured) {
        this.emitSystemEvent('system:lm.rule:structured', {
          ruleId: this.id,
          schema: this.outputSchema!.description ?? 'unknown',
          output: response,
          timestamp: Date.now(),
        });
      }

      // Tool delegation for structured output
      if (usedStructured && this.enableTools && this.toolDispatcher) {
        const delegated = await this.tryToolDelegation(
          response,
          primary,
          secondary,
          context,
          signal
        );
        if (delegated) {
          response = delegated;
          this.emitSystemEvent('system:lm.rule:structured', {
            ruleId: this.id,
            schema: this.outputSchema!.description ?? 'unknown',
            output: response,
            timestamp: Date.now(),
          });
        }
      }

      const duration = Date.now() - startTime;
      this.emitEvent('lm.response', {
        ruleId: this.id,
        prompt,
        response,
        duration,
        timestamp: Date.now(),
      });

      const tasks = this.processAndGenerate(response, primary, secondary, lmContext, context);
      this.recordSuccess(duration, prompt.length + response.length);
      this.emitSystemEvent('system:lm.rule:applied', {
        ruleId: this.id,
        ruleName: this.name,
        primaryTerm: primary.toString(),
        secondaryTerm: secondary?.toString(),
        tasksProduced: tasks.length,
        durationMs: duration,
        timestamp: Date.now(),
        schema: usedStructured ? (this.outputSchema!.description ?? 'unknown') : undefined,
      });
      return tasks;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emitEvent('lm.failure', {
        ruleId: this.id,
        error: errMsg(error),
        duration,
        timestamp: Date.now(),
      });
      if ((error as Error).name === 'AbortError') throw error;
      this.recordFailure(duration);
      return this.applyFallback(primary, secondary, context);
    }
  }

  getStats(): LMRuleStats {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      stats: this.stats,
      circuitState: this.circuitBreaker.getState() as 'closed' | 'open' | 'half-open',
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
    this.stats = createLMStats();
  }

  private getSkipReason(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ): NAREventMap['system:lm.rule:skipped']['reason'] | null {
    if (!this.enabled) return 'disabled';
    if (this.circuitBreaker.getState() === 'open') return 'circuit_open';
    if (!this.lm || !primary) return 'disabled';
    if (!this.baseConfig.singlePremise && !secondary) return 'single_premise_missing';
    if (
      this.baseConfig.activationCondition &&
      !this.baseConfig.activationCondition(primary, secondary, context)
    )
      return 'activation_failed';
    return null;
  }

  private buildLMContext(
    primary: Term,
    secondary?: Term,
    context?: Record<string, unknown>
  ): LMContext {
    return {
      memorySnapshot: context?.memorySnapshot as string,
      relatedBeliefs: context?.relatedBeliefs as string[],
      recentDerivations: context?.recentDerivations as string[],
      activeGoals: context?.activeGoals as string[],
      confidence: context?.confidence as number,
      conceptPriority: context?.priority as number,
      taskTerm: primary.toString(),
      secondaryTerm: secondary?.toString(),
      taskType: context?.taskType as string,
      driveState: context?.driveState as Record<string, number>,
      conflictCount: context?.conflictCount as number,
      memoryPressure: context?.memoryPressure as number,
      totalConcepts: context?.totalConcepts as number,
    };
  }

  private emitEvent(eventName: string, data: unknown): void {
    if (this.eventBus) this.eventBus.emit(eventName, data);
  }

  private emitSystemEvent(event: keyof NAREventMap, data: unknown): void {
    if (this.systemEventBus) this.systemEventBus.emit(event as string, data);
  }

  private async executeLM(prompt: string, signal?: AbortSignal): Promise<string | null> {
    if (!this.lm) throw new Error(`LM unavailable for rule ${this.id}`);
    const options = {
      ...this.baseConfig.lmOptions,
      signal,
      grammar: this.baseConfig.grammar,
      maxOutputTokens: this.baseConfig.maxOutputTokens ?? this.baseConfig.lmOptions?.maxTokens,
    };
    // Universal failure escalation: attempt → temp+0.2 retry → null (symbolic fallback).
    return await this.circuitBreaker.execute(
      async () => await this.lm!.tryGenerateText(prompt, options)
    );
  }

  private async executeStructured(prompt: string, signal?: AbortSignal): Promise<string | null> {
    if (!this.structuredModel || !this.outputSchema) {
      return this.executeLM(prompt, signal);
    }
    const start = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        const res = await generateObject({
          model: this.structuredModel!,
          prompt,
          schema: zodSchema(this.outputSchema!),
          abortSignal: signal,
        });
        return JSON.stringify(res.object);
      });
      recordLMCall(this.stats, true, Date.now() - start, prompt.length + result.length);
      return result;
    } catch (e) {
      recordLMCall(this.stats, false, Date.now() - start, prompt.length);
      throw e;
    }
  }

  private async tryToolDelegation(
    response: string,
    primary: Term,
    secondary: Term | undefined,
    context: Record<string, unknown> | undefined,
    signal?: AbortSignal
  ): Promise<string | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || !('tool' in parsed) || !('args' in parsed))
      return null;
    const { tool, args } = parsed as { tool: unknown; args: unknown };
    if (typeof tool !== 'string' || !tool || typeof args !== 'object' || args === null) return null;
    if (signal?.aborted) return null;
    try {
      const toolResult = await this.toolDispatcher!(tool, args as Record<string, unknown>);
      const toolContext = { ...context, toolResult };
      return await this.executeStructured(
        this.generatePrompt(
          primary,
          secondary,
          this.buildLMContext(primary, secondary, toolContext),
          toolContext
        ),
        signal
      );
    } catch (e) {
      this.emitEvent('lm.tool-error', {
        ruleId: this.id,
        tool,
        error: errMsg(e),
        timestamp: Date.now(),
      });
      return null;
    }
  }

  private generatePrompt(
    primary: Term,
    secondary: Term | undefined,
    lmContext: LMContext,
    context?: Record<string, unknown>
  ): string {
    if (this.v2PromptFn) {
      return this.v2PromptFn(
        {
          primary: primary.toString(),
          secondary: secondary?.toString(),
          context,
        },
        lmContext
      );
    }
    const template = this.baseConfig.promptTemplate;
    if (typeof template === 'function') {
      return template(primary, secondary, context);
    }
    if (typeof template === 'string') {
      return this.fillTemplate(template, primary, secondary, lmContext);
    }
    return `Reason about: ${primary.toString()}`;
  }

  private fillTemplate(
    template: string,
    primary: Term,
    secondary?: Term,
    lmContext?: LMContext
  ): string {
    const beliefs = lmContext?.relatedBeliefs ?? [];
    return template
      .replaceAll('{{primaryTerm}}', primary.toString())
      .replaceAll('{{secondaryTerm}}', secondary?.toString() ?? '')
      .replaceAll('{{premise1}}', beliefs[0] ?? '')
      .replaceAll('{{premise2}}', beliefs[1] ?? '');
  }

  /** Pure-NAL symbolic fallback on LM failure; null → skip, [] → silent degrade. */
  private applyFallback(
    primary: Term,
    secondary: Term | undefined,
    context?: Record<string, unknown>
  ): Task[] {
    const fallback = this.baseConfig.fallback;
    if (!fallback) return [];
    const tasks = fallback(primary, secondary, context) as Task[] | null;
    this.emitEvent('lm.fallback', {
      ruleId: this.id,
      primaryTerm: primary.toString(),
      tasksProduced: tasks?.length ?? 0,
      timestamp: Date.now(),
    });
    return tasks ?? [];
  }

  private processAndGenerate(
    response: string,
    primary: Term,
    secondary: Term | undefined,
    lmContext: LMContext,
    context?: Record<string, unknown>
  ): Task[] {
    if (this.outputSchema) {
      return this.processStructuredResponse(response, primary, secondary, lmContext);
    }
    const processed = this.processResponse(response, primary, secondary, context);
    return this.generateTasks(processed, primary, secondary, context);
  }

  private processStructuredResponse(
    response: string,
    primary: Term,
    _secondary: Term | undefined,
    _lmContext: LMContext
  ): Task[] {
    let parsed: unknown;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response };
    } catch {
      parsed = { response };
    }

    if (this.validateFn) {
      const validation = this.validateFn(parsed);
      if (!validation.valid) return [];
    }

    return this.generateTasksFromStructured(parsed as Record<string, unknown>, primary);
  }

  private generateTasksFromStructured(output: Record<string, unknown>, primary: Term): Task[] {
    if (Array.isArray(output?.tasks)) {
      return (output.tasks as Array<{ narsese: string; truth?: { f: number; c: number } }>).map(
        (t) => {
          const parsed = LMResponseParser.parse(t.narsese);
          return createTask(
            parsed.valid && parsed.term ? parsed.term : primary,
            this.taskType,
            parsed.truth
          );
        }
      );
    }
    const narsese =
      (output?.narsese as string) ?? (output?.response as string) ?? primary.toString();
    const parsed = LMResponseParser.parse(narsese);
    return [
      createTask(parsed.valid && parsed.term ? parsed.term : primary, this.taskType, parsed.truth),
    ];
  }

  private processResponse(
    response: string,
    primary: Term,
    secondary: Term | undefined,
    context?: Record<string, unknown>
  ): unknown {
    const repaired = response;
    return this.baseConfig.responseProcessor
      ? this.baseConfig.responseProcessor(repaired, primary, secondary, context)
      : repaired;
  }

  private generateTasks(
    processed: unknown,
    primary: Term,
    secondary: Term | undefined,
    context?: Record<string, unknown>
  ): Task[] {
    if (this.baseConfig.taskGenerator)
      return this.baseConfig.taskGenerator(processed, primary, secondary, context) as Task[];
    if (Array.isArray(processed)) return processed.map((p) => this.taskFromProcessed(p, primary));
    return [this.taskFromProcessed(processed, primary)];
  }

  private checkConstitution(task: Task, fallbackTerm: Term): Task {
    if (this.constitutionAware && this.nar && this.nar.checkConstitutionViolation(task)) {
      this.emitSystemEvent('system:lm.rule:constitution-violation', {
        ruleId: this.id,
        term: task.term.toString(),
        clause: 'constitution conflict',
        timestamp: Date.now(),
      });
      return createTask(fallbackTerm, this.taskType, Truth.NEUTRAL);
    }
    return task;
  }

  private taskFromProcessed(processed: unknown, primary: Term): Task {
    if (typeof processed === 'string') {
      const parsed = LMResponseParser.parse(processed);
      if (parsed.valid && parsed.term) {
        return this.checkConstitution(
          createTask(
            parsed.term,
            this.taskType,
            parsed.truth,
            parsed.confidence != null
              ? {
                  priority: parsed.confidence,
                  durability: 0.8,
                  quality: 0.9,
                  cycles: 0,
                  depth: 0,
                }
              : undefined
          ),
          primary
        );
      }
    }

    const term = (processed as Partial<Task> & { term?: Term }).term ?? primary;
    const type = (processed as Partial<Task> & { type?: TaskType }).type ?? this.taskType;
    const truth = (processed as Partial<Task> & { truth?: TruthType }).truth ?? Truth.NEUTRAL;
    const budget = (processed as Partial<Task> & { budget?: Budget }).budget;

    return this.checkConstitution(createTask(term, type, truth, budget ?? undefined), primary);
  }

  private recordSuccess(duration: number, tokens: number): void {
    recordLMCall(this.stats, true, duration, tokens);
  }

  private recordFailure(duration: number): void {
    recordLMCall(this.stats, false, duration, 0);
  }
}

export interface ParsedLMResponse {
  term: Term;
  truth: TruthType;
  confidence?: number;
  raw: string;
  valid: boolean;
  error?: string;
}

export interface StructuredLMOutput {
  narsese: string;
  truth?: { f: number; c: number };
  confidence?: number;
}

const invalid = (raw: string, error: string): ParsedLMResponse => ({
  term: termParser.parse('TRUE'),
  truth: Truth.NEUTRAL,
  valid: false,
  raw,
  error,
});

const parseNarseseWithTruth = (text: string, raw: string): ParsedLMResponse => {
  try {
    const { term, truth } = termParser.parseWithTruth(text);
    return { term, truth: truth ?? Truth.NEUTRAL, raw, valid: true };
  } catch {
    return invalid(raw, 'Invalid Narsese syntax');
  }
};

export const LMResponseParser = {
  parse(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const structured = extractStructuredOutput(response);
    if (structured) {
      try {
        const { term, truth } = termParser.parseWithTruth(structured.narsese);
        const finalTruth = structured.truth
          ? Truth.create(structured.truth.f, structured.truth.c)
          : (truth ?? Truth.NEUTRAL);
        return {
          term,
          truth: finalTruth,
          confidence: structured.confidence,
          raw: response,
          valid: true,
        };
      } catch (error) {
        return invalid(response, errMsg(error));
      }
    }
    return parseNarseseWithTruth(response.trim(), response);
  },

  validate(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const trimmed = response.trim();
    if (trimmed.startsWith('{')) {
      let parsed: { narsese?: unknown; truth?: { f: number; c: number } };
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return invalid(response, 'Invalid JSON in response');
      }
      if (typeof parsed.narsese !== 'string')
        return invalid(response, 'Missing narsese field in JSON');
      try {
        const { term, truth } = termParser.parseWithTruth(parsed.narsese);
        const finalTruth = parsed.truth
          ? Truth.create(parsed.truth.f, parsed.truth.c)
          : (truth ?? Truth.NEUTRAL);
        return { term, truth: finalTruth, raw: response, valid: true };
      } catch (error) {
        return invalid(response, errMsg(error));
      }
    }
    return parseNarseseWithTruth(trimmed, response);
  },
};

function extractStructuredOutput(response: string): StructuredLMOutput | null {
  const jsonMatch = response.match(/\{[\s\S]*"narsese"\s*:[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
