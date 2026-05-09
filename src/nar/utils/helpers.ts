/**
 * Common utility functions used throughout the codebase
 */

/**
 * Clamps a value between min and max
 */
export const clamp = (v: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, v));

/**
 * Calculate average of numbers, returns 0 for empty array
 */
export const average = (values: number[]): number =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/**
 * Safe division that returns 0 when denominator is 0
 */
export const safeDiv = (num: number, den: number): number =>
    den === 0 ? 0 : clamp(num / den, 0, 1);

/**
 * Deep freeze an object
 */
export const deepFreeze = <T>(obj: T): Readonly<T> => {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        const value = (obj as Record<string, unknown>)[prop];
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    });
    return obj as Readonly<T>;
};

/**
 * Create a unique ID
 */
export const makeId = (): string => crypto.randomUUID();

/**
 * Check if value is null or undefined
 */
export const isNil = (value: unknown): value is null | undefined =>
    value == null;

/**
 * Ensure array is non-null
 */
export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] => {
    if (arr == null) return [];
    return Array.isArray(arr) ? arr : [arr];
};
