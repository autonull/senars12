/**
 * Variable Term Operations — advanced variable manipulation.
 */
import { termFactory } from './factory';
import { unify as unifyImpl } from '../unify';
/** Variable generator for creating fresh variables. */
export class VariableGenerator {
    counter = 0;
    prefix = '_';
    constructor(prefix = '_') {
        this.prefix = prefix;
    }
    /** Generate a fresh variable. */
    fresh() {
        return termFactory.variable(`${this.prefix}${this.counter++}`);
    }
    /** Generate a named variable. */
    named(name) {
        return termFactory.variable(name);
    }
    /** Reset the counter. */
    reset() {
        this.counter = 0;
    }
    /** Set the counter. */
    setCounter(value) {
        this.counter = value;
    }
    /** Get current counter. */
    getCounter() {
        return this.counter;
    }
}
/** Default variable generator. */
export const variableGenerator = new VariableGenerator();
/** Get most general unifier. */
export function mgu(a, b) {
    const result = unifyImpl(a, b, {});
    if (result.success && result.substitution) {
        return result.substitution;
    }
    return null;
}
/** Check if two terms are unifiable. */
export function isUnifiable(a, b) {
    const result = unifyImpl(a, b, {});
    return result.success;
}
