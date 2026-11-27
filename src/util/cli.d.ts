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
 * unless it is itself a flag; `--flag=value` is also accepted. A lone `--` is
 * skipped rather than parsed: `pnpm run bot -- "<narsese>"` leaks the separator
 * into the script's argv, and treating it as a flag would let it swallow the
 * sentence after it.
 */
export declare function parseFlags(argv?: readonly string[]): Flags;
/** Whether the caller wants JSON output (`--json` flag or non-TTY stdout). */
export declare const jsonMode: (argv?: readonly string[]) => boolean;
//# sourceMappingURL=cli.d.ts.map