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

/** Characters per token in {@link estimateTokens} — its inverse, for budgeting characters from a token allowance. */
export const CHARS_PER_TOKEN = 4;

/** Rough token count: ~4 characters per token. Single source for every budget. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Abort signal that fires after `timeoutMs`; call `done()` in a `finally` to release the timer. */
export const boundedSignal = (timeoutMs: number): { signal: AbortSignal; done: () => void } => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(timeoutMs)), timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

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
  return Promise.race([
    work.then((value) => ({ value, timedOut: false as const })),
    deadline,
  ]).finally(() => clearTimeout(timer));
}

export const compact = <T>(arr: (T | null | undefined | false | '' | 0)[]): T[] =>
  arr.filter(Boolean) as T[];

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Occupancy of a bounded resource in `0..1` — the AIKR pressure signal every
 * bounded container reports, so "how full is this" is answered the same way by
 * the bag, the link layer, and the pending-request queue.
 *
 * A non-positive `capacity` is an *unbounded* container: it has no admission
 * check, so it can never shed load, and it is therefore reported as fully
 * occupied. Reporting `0` there would let an unbounded queue look idle.
 */
export const occupancy = (used: number, capacity: number): number =>
  capacity > 0 ? clamp01(used / capacity) : 1;

/** Round to `digits` decimal places — the one float-noise guard for reported values. */
export const roundTo = (v: number, digits = 2): number => {
  const scale = 10 ** digits;
  return Math.round(v * scale) / scale;
};

export const edgeKey = (source: string, target: string): string => `${source}->${target}`;

/** Plain-object guard — the one object test behind config merging and tool schemas. */
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Recursively merge `override` onto `base`. Plain objects merge key-by-key;
 * arrays and primitives replace wholesale, so a partial config narrows a list
 * rather than interleaving with the default. `undefined` overrides are skipped.
 */
export const deepMerge = <T>(base: T, override: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  }
  return merged as T;
};

/** Logistic function; the single sigmoid used by scoring and gradient descent. */
export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export const softmax = (values: readonly number[]): number[] => {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / total);
};

export const safeDiv = (num: number, den: number): number =>
  den === 0 ? 0 : clamp(num / den, 0, 1);

/** Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums). */
export const mean = <T>(
  items: readonly T[],
  value: (item: T) => number = (item) => item as unknown as number
): number =>
  items.length === 0 ? 0 : items.reduce((sum, item) => sum + value(item), 0) / items.length;

/** Population variance of a projection; 0 for fewer than two samples. */
export const variance = <T>(
  items: readonly T[],
  value: (item: T) => number = (item) => item as unknown as number
): number => {
  if (items.length < 2) return 0;
  const avg = mean(items, value);
  return mean(items, (item) => (value(item) - avg) ** 2);
};

/** Population standard deviation — `sqrt(variance)`. */
export const stdDev: typeof variance = (items, value) => Math.sqrt(variance(items, value));

/**
 * Pearson correlation over the leading `min(xs, ys)` samples. The single
 * correlation implementation behind head training and RL parity scoring.
 */
export const pearson = (xs: readonly number[], ys: readonly number[]): number => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
};

/**
 * UCB1 exploration term: `c · sqrt(ln(total) / visits)`, with untried arms
 * scored as the maximum. The single bandit formula behind every UCB policy —
 * the reflex and the manifold RL agent must not drift apart.
 */
export const ucb1 = (value: number, visits: number, totalVisits: number, c: number): number => {
  if (visits <= 0) return Number.POSITIVE_INFINITY;
  return value + c * Math.sqrt(Math.log(Math.max(1, totalVisits)) / visits);
};

/**
 * Deterministic JSON with object keys emitted in sorted order — the single
 * serializer behind every cache key and content digest, so two structurally
 * equal values always digest identically regardless of insertion order.
 * `undefined` members are dropped, matching `JSON.stringify`.
 *
 * `sortArrays` treats array order as non-semantic, so `{ filters: ['b','a'] }`
 * and `{ filters: ['a','b'] }` are one value. Use it only where a list is a
 * set — strategy config, filters, tags — never for an ordered sequence.
 */
export function stableStringify(value: unknown, sortArrays = false): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (ArrayBuffer.isView(value)) {
    return JSON.stringify(Array.from(value as unknown as ArrayLike<number>));
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item, sortArrays));
    return `[${sortArrays ? items.sort() : items.join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v, sortArrays)}`).join(',')}}`;
}

/** Structural equality via {@link stableStringify} — order-insensitive for object keys. */
export const deepEqual = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/** Lowercased word-token set — the tokenizer behind every text-similarity path. */
export const tokenizeWords = (text: string, splitPattern: RegExp = /\s+/): Set<string> =>
  new Set(text.toLowerCase().split(splitPattern).filter(Boolean));

export const wordOverlap = (a: string, b: string, splitPattern?: RegExp): number => {
  const aWords = tokenizeWords(a, splitPattern);
  const bWords = tokenizeWords(b, splitPattern);
  const denominator = Math.max(aWords.size, bWords.size);
  if (denominator === 0) return 0;
  let overlap = 0;
  for (const word of aWords) if (bWords.has(word)) overlap++;
  return overlap / denominator;
};

/** Dotted-path read; missing or non-object segments yield `undefined`. */
export const getNested = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | null)?.[key], obj);

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

/**
 * Monotonic, collision-resistant id. Pass an injectable `rng` (seeded runs,
 * deterministic replay) — the default source is the global `Math.random`.
 */
export function generateId(prefix: string, rng: () => number = Math.random): string {
  return `${prefix}-${Date.now()}-${++msgCounter}-${rng().toString(36).slice(2, 6)}`;
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

/** One issue's worth of what a diagnostic can say; the shape every schema issue already has. */
export interface SchemaIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/**
 * The monorepo's one rendering of a schema failure. Four validators used to
 * spell this out, in two formats, one of which dropped the path entirely — so
 * the same invalid config produced a different diagnostic depending on which
 * boundary rejected it.
 */
export const formatIssues = (issues: readonly SchemaIssue[], separator = '; '): string =>
  issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join(separator);

/** Byte-safe truncation for tool output — never splits a multi-byte character. */
export const truncateBytes = (
  text: string,
  maxBytes: number
): { text: string; truncated: boolean } => {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return { text, truncated: false };
  return {
    text: Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8'),
    truncated: true,
  };
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
