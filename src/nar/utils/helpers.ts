export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const average = (values: number[]): number => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const safeDiv = (num: number, den: number): number => den === 0 ? 0 : clamp(num / den, 0, 1);
export const makeId = (): string => crypto.randomUUID();
export const isNil = (value: unknown): value is null | undefined => value == null;
export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] => arr == null ? [] : Array.isArray(arr) ? arr : [arr];
export const errMsg = (e: unknown): string => e instanceof Error ? e.message : String(e);
export const toError = (e: unknown): Error => e instanceof Error ? e : new Error(String(e));
