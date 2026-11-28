import { SenarsError } from '@senars/errors';
import type { Term } from '../../terms';
import type { Task, TaskType } from '../../types';
import { type NarEventBus } from '../../types';
import type { LMRuleConfig, LMService, ModelRuleStats } from '../lm-service';
import type { LMRuleConfigV2 } from './types-v2';
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
export declare class LmCallTimeout extends SenarsError {
    readonly ruleId: string;
    readonly timeoutMs: number;
    constructor(ruleId: string, timeoutMs: number, options?: ErrorOptions);
}
/** The default bound on one rule's provider call — the config's `lm.callTimeoutMs`. */
export declare const DEFAULT_CALL_TIMEOUT_MS = 8000;
export type { ParsedLMResponse, StructuredLMOutput } from './response-parser';
export { LMResponseParser } from './response-parser';
export type { LMContext, ValidationResult } from './types';
export type { LMRuleConfigV2 } from './types-v2';
export declare class LMRule {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly priority: number;
    readonly sync: false;
    readonly taskType: TaskType;
    readonly condition: Term;
    private enabled;
    private readonly lm;
    private readonly baseConfig;
    /** Whether this rule declares a symbolic body — a model call that fails still derives. */
    readonly hasSymbolicFallback: boolean;
    private readonly v2Config;
    private readonly circuitBreaker;
    private readonly callTimeoutMs;
    private eventBus;
    private stats;
    private toolDispatcher?;
    private readonly enableTools;
    private readonly constitutionAware;
    private nar?;
    private systemOneAdapter?;
    private readonly outputSchema?;
    private readonly inputSchema?;
    private readonly validateFn?;
    private readonly v2PromptFn?;
    constructor(id: string, lm: LMService | null, config?: LMRuleConfig | LMRuleConfigV2);
    setEventBus(eventBus: NarEventBus): void;
    setNAR(nar: {
        checkConstitutionViolation(task: Task): boolean;
        getConstitution(): Task[];
    }): void;
    setToolDispatcher(dispatcher: (tool: string, args: Record<string, unknown>) => Promise<unknown>): void;
    setSystemOneAdapter(adapter: {
        translateToNarsese(input: string, context?: Record<string, unknown>): Promise<Task[]>;
        metaReason?(primary: Term, context?: Record<string, unknown>): Promise<Task[]>;
        calibrateUncertainty?(primary: Term, context?: Record<string, unknown>): Promise<Task[]>;
    }): void;
    canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean;
    apply(primary: Term, secondary?: Term, context?: Record<string, unknown>, signal?: AbortSignal): Promise<Task[]>;
    getStats(): ModelRuleStats;
    enable(): void;
    disable(): void;
    reset(): void;
    private getSkipReason;
    private buildLMContext;
    private emitEvent;
    /**
     * The `system:` half of the same bus, keeping its compile-time key check.
     *
     * This class held two bus fields, two setters and two emitters for one bus —
     * the composition root assigned the same object to both — so a rule wired by
     * one setter and read by the other published nothing. One field, one emit
     * path; only the key vocabulary differs.
     */
    private emitSystemEvent;
    /**
     * One provider call, bounded. The circuit breaker bounds *failure count* and
     * its `resetTimeoutMs` governs a half-open probe rather than an in-flight
     * call, so a provider that never resolves hung every caller until this
     * deadline existed (TODO29.a §0.8 finding 3).
     */
    private executeLM;
    private executeStructured;
    private tryToolDelegation;
    private generatePrompt;
    private fillTemplate;
    /** Pure-NAL symbolic fallback on LM failure; null → skip, [] → silent degrade. */
    private applyFallback;
    private processAndGenerate;
    private processStructuredResponse;
    private generateTasksFromStructured;
    private processResponse;
    private generateTasks;
    private checkConstitution;
    private taskFromProcessed;
}
//# sourceMappingURL=LMRule.d.ts.map