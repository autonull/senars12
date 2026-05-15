export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const average = (values: number[]): number => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const safeDiv = (num: number, den: number): number => den === 0 ? 0 : clamp(num / den, 0, 1);

export const deepFreeze = <T>(obj: T): Readonly<T> => {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
  });
  return obj as Readonly<T>;
};

export const makeId = (): string => crypto.randomUUID();
export const isNil = (value: unknown): value is null | undefined => value == null;
export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] => arr == null ? [] : Array.isArray(arr) ? arr : [arr];

export const errMsg = (e: unknown): string => e instanceof Error ? e.message : String(e);
export const toError = (e: unknown): Error => e instanceof Error ? e : new Error(String(e));
export const errObj = toError;

export const catchAndLog = (logger: { warn: (ctx: string, msg: string) => void }, ctx: string) => (e: unknown): string => {
  const msg = errMsg(e);
  logger.warn(ctx, msg);
  return msg;
};

export function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); });
    })
  ]);
}

export const safeJsonParse = <T>(str: string, fallback: T): T => { try { return JSON.parse(str) as T; } catch (e) { console.error('JSON parse failed:', e); return fallback; } };

export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await operation(); }
    catch (error) { if (attempt === maxRetries) throw toError(error); await new Promise(resolve => setTimeout(resolve, delayMs * attempt)); }
  }
  throw new Error('Unreachable');
}