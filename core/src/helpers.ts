export const makeId = (): string => crypto.randomUUID();
export const isNil = (value: unknown): value is null | undefined => value == null;
export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] =>
  arr == null ? [] : Array.isArray(arr) ? arr : [arr];
export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const compact = <T>(arr: (T | null | undefined | false | '' | 0)[]): T[] =>
  arr.filter(Boolean) as T[];
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
