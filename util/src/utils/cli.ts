/**
 * Typed accessor over `--flag value` style argv arrays.
 */

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
