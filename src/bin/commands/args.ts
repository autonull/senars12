/** Raw-token access for CLI commands — the single argv-shape toolkit. */

import { type Flags, getNested, parseEnvValue, parseFlags, splitWords } from '@senars/util';

/** Split a command tail into positional tokens; an empty tail yields no tokens. */
export const tokenize = (args = ''): string[] => splitWords(args);

/**
 * Flag-aware view of a command tail. Positional tokens exclude both the flag
 * and its value, so `--password pw` never leaks `pw` into positionals.
 */
export const flagsOf = (args = ''): Flags => parseFlags(tokenize(args));

/**
 * Dotted-path write that refuses to traverse through leaf values, so a bad path
 * reports `Unknown path` instead of silently assigning into a primitive.
 * Missing intermediate *objects* are not created — the path must already resolve.
 */
export const setPath = (obj: Record<string, unknown>, path: string, value: unknown): boolean => {
  const keys = path.split('.');
  const leaf = keys.pop();
  if (leaf === undefined) return false;
  const parent = keys.length ? getNested(obj, keys.join('.')) : obj;
  if (typeof parent !== 'object' || parent === null) return false;
  (parent as Record<string, unknown>)[leaf] = value;
  return true;
};

/**
 * CLI value coercion for `.config-set` / `.s1-config set` — the same truthiness
 * and number vocabulary as env overrides, so a literal means one thing whichever
 * path set it. `null` stays literal because a config file can express a real null.
 */
export const coerce = (raw: string): unknown =>
  raw === 'null' ? null : raw.trim() === '' ? raw : parseEnvValue(raw);

export type SubHandler = (rest: string[]) => string | Promise<string>;

/**
 * Table-driven subcommand dispatch: a bare invocation resolves to the first
 * `defaults` verb, unknown verbs fall through to `usage`. Handlers receive the
 * tokens after the verb.
 */
export const dispatchSub = (
  args: string,
  table: Readonly<Record<string, SubHandler>>,
  options: { readonly defaults?: readonly string[]; readonly usage: string }
): string | Promise<string> => {
  const [sub, ...rest] = tokenize(args);
  const verb = (sub ?? options.defaults?.[0] ?? '').toLowerCase();
  const handler = table[verb];
  return handler ? handler(rest) : options.usage;
};

/** Parse a bounded 0-1 ratio, or report why it is out of range. */
export const ratioArg = (raw: string, label: string): { value: number } | { error: string } => {
  const value = Number(raw);
  return Number.isNaN(value) || value < 0 || value > 1
    ? { error: `${label} must be 0-1` }
    : { value };
};

/** Parse a positive integer, or report why it is out of range. */
export const positiveArg = (raw: string, label: string): { value: number } | { error: string } => {
  const value = Number(raw);
  return Number.isNaN(value) || value < 1
    ? { error: `${label} must be a positive number` }
    : { value };
};
