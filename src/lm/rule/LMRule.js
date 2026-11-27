import { createLMStats, recordLMCall } from '@senars/types/llm';
import { errMsg } from '@senars/util/error';
import { parseJsonOr } from '@senars/util/fs';
import { stopwatch, withTimeout } from '@senars/util/async';
import { SenarsError } from '@senars/errors';
import { Truth } from '../../terms';
import { createTask } from '../../types';
import { CircuitBreaker } from '@senars/util/circuit-breaker';
import { parseJsonObject } from '../json';
import { lmTaskWeight } from '../task-weights';
import { LMResponseParser } from './response-parser';
import { interpolateTemplate } from './types';
/**
 * Conformance with the core's contract is structural and is checked where it is
 * relied on: `RuleProcessor.registerModelRule` takes a `ModelRule` and this
 * class is what the layer hands it (`facade/index.ts` `initializeLMRules`), so a
 * member added to `ModelRule` and not provided here fails the build at that
 * call rather than at runtime (TODO29.a §5.2).
 */
/**
 * A provider call that missed its deadline. Named so the caller can tell a
 * timeout from a refusal: both fall back to the symbolic body, and only one of
 * them is worth retrying later.
 */
export class LmCallTimeout extends SenarsError {
    ruleId;
    timeoutMs;
    constructor(ruleId, timeoutMs, options) {
        super(`LM rule ${ruleId} exceeded its ${timeoutMs}ms call deadline`, 'TIMEOUT', {
            ruleId,
            timeoutMs,
        }, options);
        this.ruleId = ruleId;
        this.timeoutMs = timeoutMs;
        this.name = 'LmCallTimeout';
    }
}
/** The default bound on one rule's provider call — the config's `lm.callTimeoutMs`. */
export const DEFAULT_CALL_TIMEOUT_MS = 8000;
export { LMResponseParser } from './response-parser';
export class LMRule {
    id;
    name;
    description;
    category;
    priority;
    sync = false;
    taskType;
    condition; // NEW: real term for RuleGraph matching
    enabled;
    lm;
    baseConfig;
    /** Whether this rule declares a symbolic body — a model call that fails still derives. */
    hasSymbolicFallback;
    v2Config;
    circuitBreaker;
    callTimeoutMs;
    eventBus;
    stats = createLMStats();
    toolDispatcher;
    enableTools;
    constitutionAware;
    nar;
    systemOneAdapter;
    outputSchema;
    inputSchema;
    validateFn;
    v2PromptFn;
    constructor(id, lm, config = {}) {
        const v2 = config;
        this.id = id;
        this.name = config.name ?? id;
        this.description = config.description ?? 'LM-based inference rule';
        this.category = config.category ?? 'general';
        this.priority = config.priority ?? 1.0;
        this.taskType = v2.taskType ?? 'belief';
        // NEW: condition term for RuleGraph matching — synthesize from name for backward compat
        this.condition = v2.condition ?? { kind: 'atom', symbol: this.name };
        this.enabled = config.enabled ?? true;
        this.lm = lm;
        this.v2Config = v2;
        this.baseConfig = config;
        this.hasSymbolicFallback = typeof this.baseConfig.fallback === 'function';
        this.outputSchema = v2.outputSchema;
        this.inputSchema = v2.inputSchema;
        this.validateFn = v2.validate;
        this.constitutionAware = v2.constitutionAware ?? false;
        const tpl = config.promptTemplate;
        if (typeof tpl === 'function' &&
            (v2.promptVersion === 2 || (v2.promptVersion !== 1 && (v2.inputSchema || v2.outputSchema)))) {
            this.v2PromptFn = tpl;
        }
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            resetTimeoutMs: 60000,
            successThreshold: 1,
            quiet: true,
        });
        this.callTimeoutMs = config.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
        this.eventBus = null;
        this.enableTools = v2.enableTools ?? false;
    }
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    setNAR(nar) {
        this.nar = nar;
    }
    setToolDispatcher(dispatcher) {
        this.toolDispatcher = dispatcher;
    }
    setSystemOneAdapter(adapter) {
        this.systemOneAdapter = adapter;
    }
    canApply(primary, secondary, context) {
        return !this.getSkipReason(primary, secondary, context);
    }
    async apply(primary, secondary, context, signal) {
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
        // System One adapter fast path (§8 dispositions). Translation falls through
        // to the generative LM on empty; REPLACE rules (meta-reasoning,
        // uncertainty-calibration) never reach the generative path.
        const adapter = this.systemOneAdapter;
        const systemOneMethod = this.id === 'lm-narsese-translation' && adapter
            ? (primary, ctx) => adapter.translateToNarsese(primary.toString(), ctx)
            : this.id === 'lm-meta-reasoning' && adapter?.metaReason
                ? adapter.metaReason.bind(adapter)
                : this.id === 'lm-uncertainty-calibration' && adapter?.calibrateUncertainty
                    ? adapter.calibrateUncertainty.bind(adapter)
                    : null;
        if (systemOneMethod) {
            try {
                const tasks = await systemOneMethod(primary, context);
                if (tasks.length > 0 || this.id !== 'lm-narsese-translation') {
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
            }
            catch (e) {
                this.emitEvent('lm.failure', {
                    ruleId: this.id,
                    error: `System One adapter failed: ${e}`,
                    duration: 0,
                    timestamp: Date.now(),
                });
                // REPLACE rules never reach the generative path — degrade to the
                // symbolic fallback ([] when none). Translation falls through to LM.
                if (this.id !== 'lm-narsese-translation') {
                    return this.applyFallback(primary, secondary, context);
                }
            }
        }
        const elapsed = stopwatch();
        try {
            const lmContext = this.buildLMContext(primary, secondary, context);
            const prompt = this.generatePrompt(primary, secondary, lmContext, context);
            this.emitEvent('lm.prompt', {
                ruleId: this.id,
                ruleName: this.name,
                prompt,
                timestamp: Date.now(),
            });
            let response;
            const usedStructured = !!this.outputSchema;
            if (usedStructured) {
                response = await this.executeStructured(prompt, signal);
            }
            else {
                response = await this.executeLM(prompt, signal);
            }
            if (!response) {
                recordLMCall(this.stats, false, elapsed());
                return this.applyFallback(primary, secondary, context);
            }
            if (usedStructured) {
                this.emitSystemEvent('system:lm.rule:structured', {
                    ruleId: this.id,
                    schema: this.outputSchema.description ?? 'unknown',
                    output: response,
                    timestamp: Date.now(),
                });
            }
            // Tool delegation for structured output
            if (usedStructured && this.enableTools && this.toolDispatcher) {
                const delegated = await this.tryToolDelegation(response, primary, secondary, context, signal);
                if (delegated) {
                    response = delegated;
                    this.emitSystemEvent('system:lm.rule:structured', {
                        ruleId: this.id,
                        schema: this.outputSchema.description ?? 'unknown',
                        output: response,
                        timestamp: Date.now(),
                    });
                }
            }
            const duration = elapsed();
            this.emitEvent('lm.response', {
                ruleId: this.id,
                prompt,
                response,
                duration,
                timestamp: Date.now(),
            });
            const tasks = this.processAndGenerate(response, primary, secondary, lmContext, context);
            recordLMCall(this.stats, true, duration, prompt.length + response.length);
            this.emitSystemEvent('system:lm.rule:applied', {
                ruleId: this.id,
                ruleName: this.name,
                primaryTerm: primary.toString(),
                secondaryTerm: secondary?.toString(),
                tasksProduced: tasks.length,
                durationMs: duration,
                timestamp: Date.now(),
                schema: usedStructured ? (this.outputSchema.description ?? 'unknown') : undefined,
            });
            return tasks;
        }
        catch (error) {
            const duration = elapsed();
            this.emitEvent('lm.failure', {
                ruleId: this.id,
                error: errMsg(error),
                duration,
                timestamp: Date.now(),
            });
            if (error.name === 'AbortError')
                throw error;
            recordLMCall(this.stats, false, duration);
            return this.applyFallback(primary, secondary, context);
        }
    }
    getStats() {
        return {
            id: this.id,
            name: this.name,
            enabled: this.enabled,
            stats: this.stats,
            circuitState: this.circuitBreaker.state,
        };
    }
    enable() {
        this.enabled = true;
    }
    disable() {
        this.enabled = false;
    }
    reset() {
        this.circuitBreaker.reset();
        this.stats = createLMStats();
    }
    getSkipReason(primary, secondary, context) {
        if (!this.enabled)
            return 'disabled';
        if (this.circuitBreaker.state === 'open')
            return 'circuit_open';
        if (!this.lm || !primary)
            return 'disabled';
        if (!this.baseConfig.singlePremise && !secondary)
            return 'single_premise_missing';
        if (this.baseConfig.activationCondition &&
            !this.baseConfig.activationCondition(primary, secondary, context))
            return 'activation_failed';
        return null;
    }
    buildLMContext(primary, secondary, context) {
        return {
            memorySnapshot: context?.memorySnapshot,
            relatedBeliefs: context?.relatedBeliefs,
            recentDerivations: context?.recentDerivations,
            activeGoals: context?.activeGoals,
            confidence: context?.confidence,
            conceptPriority: context?.priority,
            taskTerm: primary.toString(),
            secondaryTerm: secondary?.toString(),
            taskType: context?.taskType,
            driveState: context?.driveState,
            conflictCount: context?.conflictCount,
            memoryPressure: context?.memoryPressure,
            totalConcepts: context?.totalConcepts,
        };
    }
    emitEvent(eventName, data) {
        if (this.eventBus)
            this.eventBus.emit(eventName, data);
    }
    /**
     * The `system:` half of the same bus, keeping its compile-time key check.
     *
     * This class held two bus fields, two setters and two emitters for one bus —
     * the composition root assigned the same object to both — so a rule wired by
     * one setter and read by the other published nothing. One field, one emit
     * path; only the key vocabulary differs.
     */
    emitSystemEvent(event, data) {
        this.emitEvent(event, data);
    }
    /**
     * One provider call, bounded. The circuit breaker bounds *failure count* and
     * its `resetTimeoutMs` governs a half-open probe rather than an in-flight
     * call, so a provider that never resolves hung every caller until this
     * deadline existed (TODO29.a §0.8 finding 3).
     */
    async executeLM(prompt, signal) {
        if (!this.lm)
            throw new SenarsError(`LM unavailable for rule ${this.id}`, 'OPERATION_ERROR');
        const options = {
            ...this.baseConfig.lmOptions,
            signal,
            grammar: this.baseConfig.grammar,
            maxOutputTokens: this.baseConfig.maxOutputTokens ?? this.baseConfig.lmOptions?.maxTokens,
        };
        // Universal failure escalation: attempt → temp+0.2 retry → null (symbolic fallback).
        return await this.circuitBreaker.execute(async () => withTimeout(this.lm.tryGenerateText(prompt, options), this.callTimeoutMs, () => new LmCallTimeout(this.id, this.callTimeoutMs)));
    }
    async executeStructured(prompt, signal) {
        if (!this.lm || !this.outputSchema) {
            return this.executeLM(prompt, signal);
        }
        return this.circuitBreaker.execute(async () => JSON.stringify(await withTimeout(this.lm.generateObject(prompt, this.outputSchema, { signal }), this.callTimeoutMs, () => new LmCallTimeout(this.id, this.callTimeoutMs))));
    }
    async tryToolDelegation(response, primary, secondary, context, signal) {
        const parsed = parseJsonOr(response, null);
        if (!parsed || typeof parsed !== 'object' || !('tool' in parsed) || !('args' in parsed))
            return null;
        const { tool, args } = parsed;
        if (typeof tool !== 'string' || !tool || typeof args !== 'object' || args === null)
            return null;
        if (signal?.aborted)
            return null;
        try {
            const toolResult = await this.toolDispatcher(tool, args);
            const toolContext = { ...context, toolResult };
            return await this.executeStructured(this.generatePrompt(primary, secondary, this.buildLMContext(primary, secondary, toolContext), toolContext), signal);
        }
        catch (e) {
            this.emitEvent('lm.tool-error', {
                ruleId: this.id,
                tool,
                error: errMsg(e),
                timestamp: Date.now(),
            });
            return null;
        }
    }
    generatePrompt(primary, secondary, lmContext, context) {
        if (this.v2PromptFn) {
            return this.v2PromptFn({
                primary: primary.toString(),
                secondary: secondary?.toString(),
                context,
            }, lmContext);
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
    fillTemplate(template, primary, secondary, lmContext) {
        const beliefs = lmContext?.relatedBeliefs ?? [];
        return interpolateTemplate(template, {
            taskTerm: lmContext?.taskTerm,
            primaryTerm: primary.toString(),
            secondaryTerm: secondary?.toString(),
            premise1: beliefs[0],
            premise2: beliefs[1],
        });
    }
    /** Pure-NAL symbolic fallback on LM failure; null → skip, [] → silent degrade. */
    applyFallback(primary, secondary, context) {
        const fallback = this.baseConfig.fallback;
        if (!fallback)
            return [];
        const tasks = fallback(primary, secondary, context);
        this.emitEvent('lm.fallback', {
            ruleId: this.id,
            primaryTerm: primary.toString(),
            tasksProduced: tasks?.length ?? 0,
            timestamp: Date.now(),
        });
        return tasks ?? [];
    }
    processAndGenerate(response, primary, secondary, lmContext, context) {
        if (this.outputSchema) {
            return this.processStructuredResponse(response, primary, secondary, lmContext);
        }
        const processed = this.processResponse(response, primary, secondary, context);
        return this.generateTasks(processed, primary, secondary, context);
    }
    processStructuredResponse(response, primary, _secondary, _lmContext) {
        let parsed;
        try {
            parsed = parseJsonObject(response) ?? { response };
        }
        catch {
            parsed = { response };
        }
        if (this.validateFn) {
            const validation = this.validateFn(parsed);
            if (!validation.valid)
                return [];
        }
        return this.generateTasksFromStructured(parsed, primary);
    }
    generateTasksFromStructured(output, primary) {
        if (Array.isArray(output?.tasks)) {
            return output.tasks.map((t) => {
                const parsed = LMResponseParser.parse(t.narsese);
                return createTask(parsed.valid && parsed.term ? parsed.term : primary, this.taskType, parsed.truth);
            });
        }
        const narsese = output?.narsese ?? output?.response ?? primary.toString();
        const parsed = LMResponseParser.parse(narsese);
        return [
            createTask(parsed.valid && parsed.term ? parsed.term : primary, this.taskType, parsed.truth),
        ];
    }
    processResponse(response, primary, secondary, context) {
        const repaired = response;
        return this.baseConfig.responseProcessor
            ? this.baseConfig.responseProcessor(repaired, primary, secondary, context)
            : repaired;
    }
    generateTasks(processed, primary, secondary, context) {
        if (this.baseConfig.taskGenerator)
            return this.baseConfig.taskGenerator(processed, primary, secondary, context);
        if (Array.isArray(processed))
            return processed.map((p) => this.taskFromProcessed(p, primary));
        return [this.taskFromProcessed(processed, primary)];
    }
    checkConstitution(task, fallbackTerm) {
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
    taskFromProcessed(processed, primary) {
        if (typeof processed === 'string') {
            const parsed = LMResponseParser.parse(processed);
            if (parsed.valid && parsed.term) {
                return this.checkConstitution(createTask(parsed.term, this.taskType, parsed.truth, parsed.confidence != null ? lmTaskWeight('fallback', parsed.confidence) : undefined), primary);
            }
        }
        const term = processed.term ?? primary;
        const type = processed.type ?? this.taskType;
        const truth = processed.truth ?? Truth.NEUTRAL;
        const budget = processed.budget;
        return this.checkConstitution(createTask(term, type, truth, budget ?? undefined), primary);
    }
}
