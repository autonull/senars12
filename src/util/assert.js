/**
 * Failure-on-missing for lookups whose absence is a programming error rather
 * than a state to report. Returns the value so a `get`-then-throw helper is one
 * expression, which is the shape most of them wanted to be.
 */
import { SenarsError } from '../errors/senars-error';
export function invariant(condition, message) {
    if (!condition)
        throw new SenarsError(message, 'OPERATION_ERROR');
}
export function assertDefined(value, message) {
    if (value == null)
        throw new SenarsError(message, 'OPERATION_ERROR');
    return value;
}
