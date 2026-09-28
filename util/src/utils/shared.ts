export const makeId = (): string => crypto.randomUUID();

export const isNil = (value: unknown): value is null | undefined => value == null;

export const ensureArray = <T>(arr: T | T[] | undefined | null): T[] =>
  arr == null ? [] : Array.isArray(arr) ? arr : [arr];

/** Fixed-size slices for batched work — the one chunking primitive. */
export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step) as T[]);
  return out;
};

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/** Rough token count: ~4 characters per token. Single source for every budget. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Raised by {@link withTimeout} unless a domain error is supplied. */
export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects with `error()` when `timeoutMs` elapses. The losing promise is not
 * cancelled — it keeps running; use only where orphaned work is safe.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  error: () => Error = () => new TimeoutError(timeoutMs)
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(error()), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Cooperative deadline: resolves `{ timedOut: true }` when `timeoutMs` elapses,
 * leaving `work` running. The interruptible-execution primitive — pair with
 * `AbortSignal` when the loser must stop.
 */
export function raceDeadline<T>(
  work: Promise<T>,
  timeoutMs: number
): Promise<{ value: T; timedOut: false } | { value?: undefined; timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<{ value?: undefined; timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([work.then((value) => ({ value, timedOut: false as const })), deadline]).finally(
    () => clearTimeout(timer)
  );
}

export const compact = <T>(arr: (T | null | undefined | false | '' | 0)[]): T[] =>
  arr.filter(Boolean) as T[];

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const edgeKey = (source: string, target: string): string => `${source}->${target}`;

export const safeDiv = (num: number, den: number): number =>
  den === 0 ? 0 : clamp(num / den, 0, 1);

/** Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums). */
export const mean = <T>(items: readonly T[], value: (item: T) => number = (item) => item as unknown as number): number =>
  items.length === 0 ? 0 : items.reduce((sum, item) => sum + value(item), 0) / items.length;

export const wordOverlap = (a: string, b: string, splitPattern?: RegExp): number => {
  const pattern = splitPattern ?? /\s+/;
  const aWords = new Set(a.toLowerCase().split(pattern).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(pattern).filter(Boolean));
  if (aWords.size === 0 && bWords.size === 0) return 0;
  let overlap = 0;
  for (const w of aWords) if (bWords.has(w)) overlap++;
  return overlap / Math.max(aWords.size, bWords.size);
};

/** Dotted-path read; missing or non-object segments yield `undefined`. */
export const getNested = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | null)?.[key], obj);

/** Dotted-path write, creating missing intermediate objects. */
export function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof current[key] !== 'object' || current[key] === null) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) current[lastKey] = value;
}

/** Typed accessor over `--flag value` style argv arrays. */
export interface Flags {
  /** Raw argv (defaults to `process.argv.slice(2)`). */
  readonly argv: readonly string[];
  /** Positional arguments (tokens not consumed as a flag value). */
  readonly positional: readonly string[];
  has: (...flags: string[]) => boolean;
  str: (flag: string, fallback: string) => string;
  num: (flag: string, fallback: number) => number;
  list: (flag: string, fallback: string[]) => string[];
}

/**
 * Parses `argv` once into flag lookups. `--flag value` consumes the next token
 * unless it is itself a flag; `--flag=value` is also accepted.
 */
export function parseFlags(argv: readonly string[] = process.argv.slice(2)): Flags {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('-')) {
      positional.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq > 0) {
      flags.add(token.slice(0, eq));
      values.set(token.slice(0, eq), token.slice(eq + 1));
      continue;
    }
    flags.add(token);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('-')) values.set(token, (i++, next));
  }
  const get = (flag: string): string | undefined => values.get(flag);
  return {
    argv,
    positional,
    has: (...names) => names.some((name) => flags.has(name)),
    str: (flag, fallback) => get(flag) ?? fallback,
    num: (flag, fallback) => {
      const raw = get(flag);
      const parsed = raw === undefined ? Number.NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    list: (flag, fallback) => (get(flag) ?? fallback.join(',')).split(',').filter(Boolean),
  };
}

let msgCounter = 0;

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function extractTerm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const words = trimmed.split(/\s+/);
  return words[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) ?? undefined;
}

export function isNarsese(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('(') ||
    trimmed.startsWith('<') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  )
    return true;
  if (
    trimmed.includes('-->') ||
    trimmed.includes('<->') ||
    trimmed.includes('==>') ||
    trimmed.includes('<=>')
  )
    return true;
  if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
    const body = trimmed.slice(0, -1).trim();
    if (body.startsWith('(') || body.startsWith('<')) return true;
  }
  return false;
}

export const truncate = (text: string, maxLength = 60): string =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;

/** Byte-safe truncation for tool output — never splits a multi-byte character. */
export const truncateBytes = (text: string, maxBytes: number): { text: string; truncated: boolean } => {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return { text, truncated: false };
  return { text: Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8'), truncated: true };
};

export const limitList = <T>(
  items: T[],
  limit: number,
  format: (item: T) => string,
  moreText = 'more'
): string[] => {
  const lines = items.slice(0, limit).map(format);
  if (items.length > limit) {
    lines.push(`  ... and ${items.length - limit} ${moreText}`);
  }
  return lines;
};

/** Recursively freeze an object graph (TODO20 C3). Arrays and nested objects included. */
export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
};
