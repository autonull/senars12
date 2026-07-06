/**
 * Guard utilities for SeNARS
 */

import {Logger} from './Logger.js';

function runGuarded(guard, execute, options, isAsync) {
    const {
        defaultValue = null,
        throwOnGuardFailure = false,
        errorHandler = null,
        context = 'guarded-execution'
    } = options;

    const handleGuardError = (err) => errorHandler?.(err, 'guard') ?? (Logger.error(`[${context}] Guard evaluation failed`, err), defaultValue);
    const handleExecError = (err) => errorHandler?.(err, 'execute') ?? (Logger.error(`[${context}] Execution failed`, err), defaultValue);

    const guardResult = isAsync ? Promise.resolve(guard()).catch(handleGuardError) : (() => {
        try {
            return guard();
        } catch (err) {
            return handleGuardError(err);
        }
    })();

    const processResult = (result) => {
        const isValid = typeof result === 'boolean' ? result : result?.isValid;
        const errors = result?.errors;
        if (!isValid) {
            if (throwOnGuardFailure) {
                const error = new Error(`Guard failed: ${errors?.join(', ') || 'conditions not met'}`);
                error.guardErrors = errors;
                throw error;
            }
            if (errors?.length > 0) {
                Logger.warn(`[${context}] Guard failed`, {errors});
            }
            return defaultValue;
        }
        return isAsync ? Promise.resolve(execute()).catch(handleExecError) : (() => {
            try {
                return execute();
            } catch (err) {
                return handleExecError(err);
            }
        })();
    };

    return isAsync ? Promise.resolve(guardResult).then(processResult) : processResult(guardResult);
}

/**
 * Execute guarded operation with standardized error handling
 */
export async function executeGuarded(guard, execute, options = {}) {
    return runGuarded(guard, execute, options, true);
}

/**
 * Sync version of executeGuarded
 */
export function executeGuardedSync(guard, execute, options = {}) {
    return runGuarded(guard, execute, options, false);
}

/**
 * Abstract base class for guarded execution pattern
 */
export class GuardedExecutor {
    /**
     * Check if execution is allowed
     * @returns {boolean|Object} True or result object with isValid
     */
    canExecute() {
        return true;
    }

    /**
     * Execute the operation
     * @returns {Promise<*>} Result of execution
     */
    async execute() {
        throw new Error('execute() must be implemented by subclass');
    }

    /**
     * Run with guard
     * @param {Object} options - Options for guarded execution
     * @returns {Promise<*>} Result of execution or default value
     */
    async run(options = {}) {
        return executeGuarded(() => this.canExecute(), () => this.execute(), {context: this.constructor.name, ...options});
    }

    /**
     * Run sync with guard
     * @param {Object} options - Options for guarded execution
     * @returns {*} Result of execution or default value
     */
    runSync(options = {}) {
        return executeGuardedSync(() => this.canExecute(), () => this.execute(), {context: this.constructor.name, ...options});
    }
}
