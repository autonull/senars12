/**
 * The control budgets, declared (TODO29.a §5.7 / §7 invariant 12).
 *
 * A bound is a `ReasoningBudget` scope with a **named** `scopeId` — not a number
 * somebody reads in a hot loop. Every entry answers four questions in one row:
 * what it bounds, which dimension of the budget it spends, who owns it, and what it
 * defaults to. The other two answers are *derived* — a dimension's ceiling key and
 * the `TerminationReason` its overflow raises are `core/budget`'s to say, and a row
 * that restated them is how a scope ends up spending `memoryOps` under a
 * `cycle-budget` reason.
 *
 * Three things this table is *not*, and each was the alternative:
 *
 * - **Not a second budget type.** Every scope is the same `ReasoningBudget` the
 *   gate already accounts, so a scope is a `scopeId` plus its own ceilings.
 * - **Not a place where `decision-derivations` shares a counter with symbolic
 *   derivations.** The two are separate rows with separate ceilings, and the
 *   load-bearing consequence is testable: a decision budget of zero leaves the
 *   symbolic derivation count unchanged, which is §2.4's four-configuration
 *   invariance budgeted rather than asserted.
 * - **Not a cost model.** The default limits are behaviour-neutral relative to
 *   what the call sites already enforced by other means, and where they are
 *   genuinely new (TODO30 measures what they should be).
 */
import { type BudgetLimits, type BudgetResource } from '../budget/index';
import type { BudgetScopeId, ReasoningBudget } from '../schemas/reasoning-budget';
/** The operation a budget scope performs — one of the declared scope keys. */
export type BudgetOperation = 'derivation' | 'premise-selection' | 'candidate-derivation' | 'proposal-application' | 'control-work' | 'decision-derivation';
/** One budget dimension, spelled the way `ReasoningBudget` spells it. */
export type BudgetDimension = BudgetResource;
export type BudgetLimitKey = keyof BudgetLimits;
/** The five bounds §5.7 names. The order is the plan's. */
export { BUDGET_SCOPE_IDS, type BudgetScopeId } from '../schemas/reasoning-budget';
export interface BudgetScopeSpec {
    readonly operation: BudgetOperation;
    readonly consumedKey: BudgetDimension;
    /** The module that spends this scope, so "unbounded" has an address. */
    readonly owner: string;
    /** The declared default, used unless configuration overrides it. */
    readonly defaultLimit: number;
    /** Where a limit comes from when it is not the default. */
    readonly configSource: string;
    /**
     * The exported symbol a caller names instead of `charge(...)` — a scope spent
     * outside the cycle path, where the id is a value rather than a literal. The
     * gate reads this, so the reference is declared rather than remembered.
     */
    readonly referenceSymbol?: string;
}
export declare const BUDGET_SCOPES: {
    readonly derivations: {
        readonly operation: 'derivation';
        readonly consumedKey: 'cycles';
        readonly owner: 'InferenceController';
        readonly defaultLimit: 100;
        readonly configSource: 'inference.maxDerivationsPerStep, or controlBudgets.derivations';
    };
    readonly premises: {
        readonly operation: 'premise-selection';
        readonly consumedKey: 'cycles';
        readonly owner: 'InferenceController';
        readonly defaultLimit: 64;
        readonly configSource: 'controlBudgets.premises';
    };
    readonly 'candidate-derivations': {
        readonly operation: 'candidate-derivation';
        readonly consumedKey: 'cycles';
        readonly owner: 'RuleProcessor.applySyncRules';
        readonly defaultLimit: 16384;
        readonly configSource: 'controlBudgets.candidate-derivations';
    };
    readonly 'proposal-application': {
        readonly operation: 'proposal-application';
        readonly consumedKey: 'memoryOps';
        readonly owner: 'NARExecution.authorize';
        readonly defaultLimit: 64;
        readonly configSource: 'controlBudgets.proposal-application';
    };
    readonly 'control-work': {
        readonly operation: 'control-work';
        readonly consumedKey: 'cycles';
        readonly owner: 'NARExecution control and observability steps';
        readonly defaultLimit: 16;
        readonly configSource: 'controlBudgets.control-work';
    };
    readonly 'decision-derivations': {
        readonly operation: 'decision-derivation';
        readonly consumedKey: 'llmCalls';
        readonly owner: 'the decision layer (A11 binds the port)';
        readonly defaultLimit: 8;
        readonly configSource: 'controlBudgets.decision-derivations';
        readonly referenceSymbol: 'DECISION_DERIVATIONS_SCOPE';
    };
};
export declare const scopeSpec: (scopeId: BudgetScopeId) => BudgetScopeSpec;
/** The ceiling key a scope's dimension is limited by — derived, never declared. */
export declare const scopeLimitKey: (scopeId: BudgetScopeId) => BudgetLimitKey;
/** The `TerminationReason` a scope raises when its dimension overflows. */
export declare const scopeTerminationReason: (scopeId: BudgetScopeId) => "cycle-budget" | "llm-budget" | "memory-budget";
/**
 * The decision layer's judgment cost, charged through the kernel gate under this
 * scope rather than an ad-hoc `'default'`. Named once for both halves of the
 * decision layer: what a judgment costs, and (from A11) what it concludes.
 */
export declare const DECISION_DERIVATIONS_SCOPE: BudgetScopeId;
/** The declared limit for one scope, or the override configuration supplies. */
export declare const scopeLimit: (scopeId: BudgetScopeId, overrides?: Partial<Record<BudgetScopeId, number>>) => number;
/**
 * Resolve a scope's ceilings over a base budget: the dimension the scope spends
 * gets the declared limit, every other dimension inherits `base`, and
 * consumption starts at zero. Inheriting matters — a scope must raise *its own*
 * reason when it exhausts, never trip an unrelated dimension it never spends.
 */
export declare const scopeBudget: (scopeId: BudgetScopeId, base: ReasoningBudget, overrides?: Partial<Record<BudgetScopeId, number>>) => ReasoningBudget;
/**
 * A budget stamped with the slice identity every budget event is keyed by.
 *
 * `KernelBudgetGate` wrote that stamp with `Object.defineProperty` at four
 * places, each behind its own `if (!('id' in budget))` check — so whether a scope
 * reached the tracer with an id depended on which of the four entry points created
 * it, and the stamp was invisible to the type system because `ReasoningBudget`
 * does not declare `id`.
 */
export declare const withBudgetId: <T extends ReasoningBudget>(budget: T, id: string) => T & {
    id: string;
};
//# sourceMappingURL=budget-scopes.d.ts.map