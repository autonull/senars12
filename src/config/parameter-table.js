/**
 * TODO19 F5: the unified parameter table with ownership. Collapses the three
 * parallel tables (SelfMetaGame's knob switch-case, CognitiveParameters
 * bounds/PARAMETER_SPACE, and per-game config) into one abstraction: every
 * parameter is `{ scope, min, max, value, owner }` and actuates through an
 * owner-supplied closure. Game-local tables are scopes of the same thing;
 * system knobs are unreachable outside the SelfMetaGame (scope enforcement,
 * C3/Phase-B benches).
 */
import { clamp } from '@senars/util/numeric';
import { joinKey, splitKey } from '@senars/util/collections';
import { SenarsError } from '@senars/errors';
export class ParameterScopeError extends SenarsError {
    scope;
    parameter;
    constructor(message, scope, parameter, options) {
        super(message, 'VALIDATION_ERROR', { scope, parameter }, options);
        this.scope = scope;
        this.parameter = parameter;
        this.name = 'ParameterScopeError';
    }
}
export class ParameterTable {
    entries = new Map();
    key = (scope, name) => joinKey(scope, name);
    ledger;
    ledgerWriter = 'parameter-table';
    /** Phase B (REFACTOR.todo1): observe accepted writes into the shared ledger. */
    attachLedger(ledger, writer = 'parameter-table') {
        this.ledger = ledger;
        this.ledgerWriter = writer;
    }
    #recordChange(spec, name, oldValue, newValue) {
        if (!this.ledger || oldValue === newValue)
            return;
        const record = {
            writer: this.ledgerWriter,
            scope: spec.scope,
            parameter: name,
            oldValue,
            newValue,
            at: Date.now(),
            trigger: 'setMany',
        };
        this.ledger.record(record);
    }
    register(spec) {
        const key = this.key(spec.scope, spec.name);
        const existing = this.entries.get(key);
        this.entries.set(key, { ...spec, value: clamp(spec.value, spec.min, spec.max) });
        if (existing?.actuate)
            existing.actuate(this.entries.get(key).value);
    }
    /** Set a parameter value; the caller's scope must match the parameter's scope. */
    set(callerScope, name, value) {
        return this.setMany(callerScope, [[name, value]])[0];
    }
    /**
     * P4 (TODO20): batched write — validates and clamps all updates first (all-or-
     * nothing on scope errors), then actuates each accepted parameter exactly once.
     * Cuts per-write actuator churn when callers apply several knobs per tick.
     */
    setMany(callerScope, updates) {
        const applied = [];
        for (const [name, value] of updates) {
            const spec = this.entries.get(this.key(callerScope, name));
            if (!spec) {
                const foreign = this.entries.get(this.key('system', name));
                if (foreign && callerScope !== 'system')
                    throw new ParameterScopeError(`scope "${callerScope}" cannot tune system parameter "${name}" (owner: ${foreign.owner})`, callerScope, name);
                throw new ParameterScopeError(`unknown parameter: ${name}`, callerScope, name);
            }
            applied.push({ spec, value: clamp(value, spec.min, spec.max) });
        }
        return applied.map(({ spec, value }) => {
            const oldValue = spec.value;
            const changed = oldValue !== value;
            spec.value = value;
            if (changed) {
                spec.actuate?.(spec.value);
                this.#recordChange(spec, spec.name, oldValue, value);
            }
            return spec.value;
        });
    }
    get(scope, name) {
        return this.entries.get(this.key(scope, name))?.value;
    }
    list(scope) {
        const out = new Map();
        for (const [key, spec] of this.entries)
            if (!scope || spec.scope === scope)
                out.set(splitKey(key, 2)[1], spec.value);
        return out;
    }
}
export const createParameterTable = () => new ParameterTable();
