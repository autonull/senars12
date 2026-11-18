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
 * The `status`/`on`/`off` triple every boolean CLI switch writes.
 *
 * Three hand-written copies in `systemone.ts` — the groundedness gate, the trace
 * grader and auto-routing — each spelling the same assignment and the same
 * `on`/`off` wording, so a fourth switch would be a fourth copy by default. The
 * switch itself becomes the only thing a reader has to look at.
 *
 * Read and write rather than an object and a key: the three switches live in
 * three different config objects and none of them owns a plain `enabled` field
 * with a shared type, so a key would need the cast that this avoids.
 */
export const onOff = (
  read: () => boolean,
  write: (value: boolean) => void,
  status: (on: boolean) => string,
  label: string
): Record<string, SubHandler> => ({
  status: () => status(read()),
  on: () => {
    write(true);
    return `${label} enabled`;
  },
  off: () => {
    write(false);
    return `${label} disabled`;
  },
});

/**
 * Whether the caller wants a report in its machine form: `--json`, or a pipe.
 *
 * A pipe is the implicit request — `pnpm status > report.json` should not need a
 * flag — but only `runStatus` read `isTTY`. Three reports asked about the flag
 * alone and one about `parseFlags().has('--json') || !process.stdout.isTTY`, so
 * redirecting the same command produced different bytes depending on which
 * entry point answered, and a piped `doctor` printed prose into a `.json` file.
 */
export const jsonMode = (args?: string): boolean =>
  flagsOf(args).has('--json') || !process.stdout.isTTY;

/**
 * A report as JSON, or as the text its renderer produces.
 *
 * The two lines four reports each wrote at their emit point. Returns rather than
 * logs, so a caller that must log (`doctor`) and one that must return
 * (`status`, surfaced through the bot) read the same way.
 */
export const renderReport = <T>(
  value: T,
  render: (value: T) => string,
  args?: string
): string => (jsonMode(args) ? JSON.stringify(value, null, 2) : render(value));

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
