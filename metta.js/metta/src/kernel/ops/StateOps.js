import {exp, sym} from '../Term.js';
import {Logger} from '@senars/core';

const stateRegistry = new Map();
let stateIdCounter = 0;

const error = (msg, ...args) => exp(sym('Error'), args.length ? args : [sym(msg)]);
const getStateId = atom => atom.components?.[0]?.name;
const isStateAtom = atom => atom.operator?.name === 'State';
const validateState = atom => {
    if (!isStateAtom(atom)) {
        return error('NotAState', atom);
    }
    const id = getStateId(atom);
    const state = stateRegistry.get(id);
    return state ? null : error('StateNotFound', atom);
};

export function registerStateOps(registry) {
    registry.register('new-state', initialValue => {
        const id = `state-${++stateIdCounter}`;
        stateRegistry.set(id, {value: initialValue, version: 0});
        return exp(sym('State'), [sym(id)]);
    });

    registry.register('get-state', stateAtom => {
        const err = validateState(stateAtom);
        if (err) {
            return err;
        }
        return stateRegistry.get(getStateId(stateAtom)).value;
    });

    registry.register('change-state!', (stateAtom, newValue) => {
        const err = validateState(stateAtom);
        if (err) {
            return err;
        }
        const state = stateRegistry.get(getStateId(stateAtom));
        state.value = newValue;
        state.version++;
        return newValue;
    });

    registry.register('with-transaction', (stateAtom, operation) => {
        const id = getStateId(stateAtom);
        const state = stateRegistry.get(id);
        if (!state) {
            return error('StateNotFound', stateAtom);
        }

        const snapshot = {...state};
        try {
            return registry.execute(operation.operator?.name, ...operation.components);
        } catch (e) {
            stateRegistry.set(id, snapshot);
            return error('TransactionFailed', sym(e.message));
        }
    }, {lazy: true});

    registry.register('state-version', stateAtom => {
        const id = getStateId(stateAtom);
        const state = stateRegistry.get(id);
        return sym(String(state?.version ?? 0));
    });
}

/**
 * Register runtime configuration operations
 * These allow dynamic modification of METTA_CONFIG at runtime
 */
export function registerConfigOps(registry, configManager) {
    if (!configManager) {
        Logger.warn('ConfigOps: No configManager provided, config ops not registered');
        return;
    }

    // Get current config value
    registry.register('config-get', (keyAtom) => {
        const key = typeof keyAtom === 'string' ? keyAtom : keyAtom?.name;
        const value = configManager.get(key);
        if (value === undefined) {
            return exp(sym('Error'), [sym('ConfigNotFound'), sym(key)]);
        }
        if (typeof value === 'boolean') {
            return sym(value ? 'True' : 'False');
        }
        if (typeof value === 'number') {
            return sym(String(value));
        }
        if (typeof value === 'string') {
            return sym(value);
        }
        return sym(String(value));
    });

    // Set config value
    registry.register('config-set!', (keyAtom, valueAtom) => {
        const key = typeof keyAtom === 'string' ? keyAtom : keyAtom?.name;
        let value = typeof valueAtom === 'string' ? valueAtom.name : valueAtom;

        // Convert common patterns
        if (value === 'True') {
            value = true;
        } else if (value === 'False') {
            value = false;
        } else if (!isNaN(Number(value))) {
            value = Number(value);
        }

        try {
            configManager.set(key, value);
            return sym('OK');
        } catch (e) {
            return exp(sym('Error'), [sym(e.message)]);
        }
    });

    // JIT threshold
    registry.register('set-jit-threshold!', (n) => {
        const threshold = typeof n === 'number' ? n : Number(n?.name);
        configManager.set('jitThreshold', threshold);
        return sym('OK');
    });

    // Parallel threshold
    registry.register('set-parallel-threshold!', (n) => {
        const threshold = typeof n === 'number' ? n : Number(n?.name);
        configManager.set('parallelThreshold', threshold);
        return sym('OK');
    });

    // Zipper threshold
    registry.register('set-zipper-threshold!', (n) => {
        const threshold = typeof n === 'number' ? n : Number(n?.name);
        configManager.set('zipperThreshold', threshold);
        return sym('OK');
    });

    // Enable tensor
    registry.register('enable-tensor!', () => {
        configManager.set('tensor', true);
        return sym('OK');
    });

    // Disable tensor
    registry.register('disable-tensor!', () => {
        configManager.set('tensor', false);
        return sym('OK');
    });

    // Enable SMT
    registry.register('enable-smt!', () => {
        configManager.set('smt', true);
        return sym('OK');
    });

    // Disable SMT
    registry.register('disable-smt!', () => {
        configManager.set('smt', false);
        return sym('OK');
    });

    // Enable persistence
    registry.register('enable-persist!', (dbName) => {
        configManager.set('persist', true);
        if (dbName?.name) {
            // Could store DB name for later use
        }
        return sym('OK');
    });

    // Disable persistence
    registry.register('disable-persist!', () => {
        configManager.set('persist', false);
        return sym('OK');
    });

    // Enable JIT
    registry.register('enable-jit!', () => {
        configManager.set('jit', true);
        return sym('OK');
    });

    // Disable JIT
    registry.register('disable-jit!', () => {
        configManager.set('jit', false);
        return sym('OK');
    });

    // Enable debugging
    registry.register('enable-debug!', () => {
        configManager.set('debugging', true);
        return sym('OK');
    });

    // Disable debugging
    registry.register('disable-debug!', () => {
        configManager.set('debugging', false);
        return sym('OK');
    });

    // Get all config
    registry.register('config-dump', () => {
        const config = configManager.getAll();
        const pairs = Object.entries(config).map(([k, v]) =>
            exp(sym(':'), [sym(k), sym(String(v))])
        );
        return exp(sym('()'), pairs);
    });

    // Get config stats
    registry.register('config-stats', () => {
        const stats = configManager.getStats();
        return exp(sym('ConfigStats'), [
            exp(sym(':'), [sym('total'), sym(String(stats.totalKeys))]),
            exp(sym(':'), [sym('modified'), sym(String(stats.modifiedKeys))])
        ]);
    });
}
