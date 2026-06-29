export const clamp = (v: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, v));
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const safeDiv = (num: number, den: number): number =>
    den === 0 ? 0 : clamp(num / den, 0, 1);
export const makeId = (): string => crypto.randomUUID();
export const isNil = (value: unknown): value is null | undefined => value == null;
export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] =>
    arr == null ? [] : Array.isArray(arr) ? arr : [arr];
export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const compact = <T>(arr: (T | null | undefined | false | '' | 0)[]): T[] =>
    arr.filter(Boolean) as T[];
export const wordOverlap = (a: string, b: string, splitPattern?: RegExp): number => {
    const pattern = splitPattern ?? /\s+/;
    const aWords = new Set(a.toLowerCase().split(pattern).filter(Boolean));
    const bWords = new Set(b.toLowerCase().split(pattern).filter(Boolean));
    if (aWords.size === 0 && bWords.size === 0) return 0;
    let overlap = 0;
    for (const w of aWords) if (bWords.has(w)) overlap++;
    return overlap / Math.max(aWords.size, bWords.size);
};
