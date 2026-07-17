/**
 * Asserts a condition is truthy, throwing an error with the given message if not.
 * Use for pre/post-condition checks instead of inline `if (!x) throw`.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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

/**
 * Creates a unique edge key from source and target node IDs.
 */
export const edgeKey = (source: string, target: string): string => `${source}->${target}`;

let msgCounter = 0;

/**
 * Generates a unique ID with the given prefix.
 * Format: {prefix}-{timestamp}-{counter}-{random}
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Extracts the first word from content as a term identifier.
 * Strips non-alphanumeric characters and limits to 40 chars.
 */
export function extractTerm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const words = trimmed.split(/\s+/);
  return words[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) ?? undefined;
}

/**
 * Checks if text appears to be Narsese (NARS logic syntax).
 */
export function isNarsese(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('(') || trimmed.startsWith('<') || trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  if (trimmed.includes('-->') || trimmed.includes('<->') || trimmed.includes('==>') || trimmed.includes('<=>')) return true;
  if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
    const body = trimmed.slice(0, -1).trim();
    if (body.startsWith('(') || body.startsWith('<')) return true;
  }
  return false;
}
