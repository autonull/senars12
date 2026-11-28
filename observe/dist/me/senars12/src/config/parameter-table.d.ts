/**
 * TODO19 F5: the unified parameter table with ownership. Collapses the three
 * parallel tables (SelfMetaGame's knob switch-case, CognitiveParameters
 * bounds/PARAMETER_SPACE, and per-game config) into one abstraction: every
 * parameter is `{ scope, min, max, value, owner }` and actuates through an
 * owner-supplied closure. Game-local tables are scopes of the same thing;
 * system knobs are unreachable outside the SelfMetaGame (scope enforcement,
 * C3/Phase-B benches).
 */
import { SenarsError } from '@senars/errors';
import type { ParameterLedger } from './parameter-ledger';
export type ParameterScope = 'system' | `game:${string}`;
export interface ParameterSpec {
    name: string;
    scope: ParameterScope;
    min: number;
    max: number;
    value: number;
    /** The subsystem that owns/actuates this parameter (e.g. 'self-meta-game'). */
    owner: string;
    /** Applied on every accepted `set`; clamping happens before the call. */
    actuate?: (value: number) => void;
}
export declare class ParameterScopeError extends SenarsError {
    readonly scope: ParameterScope;
    readonly parameter: string;
    constructor(message: string, scope: ParameterScope, parameter: string, options?: ErrorOptions);
}
export declare class ParameterTable {
    #private;
    private readonly entries;
    private readonly key;
    private ledger?;
    private ledgerWriter;
    /** Phase B (REFACTOR.todo1): observe accepted writes into the shared ledger. */
    attachLedger(ledger: ParameterLedger, writer?: string): void;
    register(spec: ParameterSpec): void;
    /** Set a parameter value; the caller's scope must match the parameter's scope. */
    set(callerScope: ParameterScope, name: string, value: number): number;
    /**
     * P4 (TODO20): batched write — validates and clamps all updates first (all-or-
     * nothing on scope errors), then actuates each accepted parameter exactly once.
     * Cuts per-write actuator churn when callers apply several knobs per tick.
     */
    setMany(callerScope: ParameterScope, updates: Array<[string, number]>): number[];
    get(scope: ParameterScope, name: string): number | undefined;
    list(scope?: ParameterScope): Map<string, number>;
}
export declare const createParameterTable: () => ParameterTable;
//# sourceMappingURL=parameter-table.d.ts.map