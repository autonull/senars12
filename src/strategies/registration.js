/**
 * TODO27 §2.1–2.4 — the strategy registration contract.
 *
 * A strategy slot names a strategy *and* its configuration; the registry turns
 * that pair into a validated, memoized instance. A registration is the one
 * declaration of what a strategy is: how to build it, what configuration it
 * accepts, and whether it may hold state across a reconfigure.
 *
 * Leaf module: zod plus types, no imports from the strategy implementations, so
 * `config/` and `cognitive/` can both depend on the contract without joining the
 * strategies→lm→nar SCC.
 */
import { ensureArray } from '@senars/util/guards';
import { formatIssues } from '@senars/util/diagnostics';
import { indexBy } from '@senars/util/collections';
import { stableStringify } from '@senars/util/json';
import { z } from 'zod';
import { describeStrategyExpression } from '../reason/strategy-algebra';
/** An object schema narrowed to the registration contract. */
export const configSchema = (shape) => {
    // Strict: a key the strategy does not declare is a user error, not a silent no-op.
    const object = z.object(shape).strict();
    return {
        parse: (config) => object.parse(config),
        safeParse: (config) => {
            const result = object.safeParse(config);
            return result.success
                ? { success: true, data: result.data }
                : { success: false, error: result.error };
        },
    };
};
/**
 * Schema + default instance: a stateless strategy whose config is expressible.
 *
 * The builders erase the factory's concrete strategy type to the `StrategyImpl`
 * union — a registration is *the* slot type, and the caller casts at the
 * resolution site where the slot's own interface is known.
 */
export const configurable = (spec) => ({
    ...spec,
    stateful: false,
    defaultConfig: spec.schema.parse({}),
});
/** A strategy with nothing to configure: any `config` key is a validation error. */
export const fixed = (spec) => configurable({ ...spec, schema: configSchema({}) });
/**
 * A lazily-built singleton: one instance per registration, built on first
 * resolution and kept for the process lifetime, `config` rejected (Invariant
 * S1). For state that must survive a `reconfigure` — rule performance, graph
 * edges. Lazy so declaring one costs nothing until something asks for it.
 */
export const stateful = (spec) => {
    let instance;
    return {
        name: spec.name,
        description: spec.description,
        stateful: true,
        defaultConfig: {},
        factory: () => (instance ??= spec.factory()),
    };
};
/** A pre-built singleton: the instance *is* the registration (Invariant S1). */
export const singleton = (name, description, instance) => stateful({ name, description, factory: () => instance });
/** Recursively key-sorted JSON, so `{a,b}` and `{b,a}` are one configuration. */
export const canonicalJson = (value) => stableStringify(value, true);
/** Re-export configDigest from canonical location. */
export { configDigest } from '@senars/config/digest';
export const isStrategyExpression = (spec) => typeof spec === 'object' && !Array.isArray(spec);
/** One line for any spec, for ledgers, logs and error messages. */
export const describeSpec = (spec) => typeof spec === 'string'
    ? spec
    : isStrategyExpression(spec)
        ? describeStrategyExpression(spec)
        : spec.join('+');
const unknownName = (slot, type, name, known) => `strategies.${slot}.type: no ${type} strategy named '${name}' (available: ${known.join(', ') || 'none'})`;
/**
 * The boundary validation pass (§2.4): every strategy error a user can make is
 * found here, with the candidate list attached, rather than inside
 * `reconfigure` where the stack is four frames deep and the name is lost.
 */
export const strategySpecErrors = (slot, type, spec, config, registrations) => {
    const byName = indexBy(registrations, (r) => r.name);
    const known = [...byName.keys()].sort();
    const errors = [];
    if (config !== undefined && (Array.isArray(spec) || isStrategyExpression(spec))) {
        errors.push(`strategies.${slot}.config: a composed ${type} slot takes no config — configure its parts instead`);
    }
    if (isStrategyExpression(spec)) {
        if (type !== 'derivation') {
            errors.push(`strategies.${slot}.type: a strategy expression is a derivation-only form; name a list of ${type} strategies instead`);
        }
        return errors;
    }
    const names = ensureArray(spec);
    if (names.length === 0)
        errors.push(`strategies.${slot}.type: a composed slot needs at least one strategy name`);
    for (const [index, name] of names.entries()) {
        const registration = byName.get(name);
        if (!registration) {
            errors.push(Array.isArray(spec)
                ? unknownName(`${slot}[${index}]`, type, name, known)
                : unknownName(slot, type, name, known));
            continue;
        }
        if (config === undefined)
            continue;
        if (registration.stateful) {
            errors.push(`strategies.${slot}.config: '${name}' is stateful and accepts no config`);
            continue;
        }
        if (!registration.schema) {
            errors.push(`strategies.${slot}.config: '${name}' declares no configuration schema`);
            continue;
        }
        const parsed = registration.schema.safeParse(config);
        if (parsed.success) {
            errors.push(...(registration.validate?.(parsed.data) ?? []));
        }
        else {
            errors.push(`strategies.${slot}.config: ${formatIssues(parsed.error.issues)}`);
        }
    }
    return errors;
};
