/**
 * Typed accessor over `--flag value` style argv arrays.
 */
import { finiteOr } from './numeric';
/**
 * Parses `argv` once into flag lookups. `--flag value` consumes the next token
 * unless it is itself a flag; `--flag=value` is also accepted. A lone `--` is
 * skipped rather than parsed: `pnpm run bot -- "<narsese>"` leaks the separator
 * into the script's argv, and treating it as a flag would let it swallow the
 * sentence after it.
 */
export function parseFlags(argv = process.argv.slice(2)) {
    const values = new Map();
    const flags = new Set();
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--')
            continue;
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
        if (next !== undefined && !next.startsWith('-'))
            values.set(token, (i++, next));
    }
    const get = (flag) => values.get(flag);
    return {
        argv,
        positional,
        has: (...names) => names.some((name) => flags.has(name)),
        str: (flag, fallback) => get(flag) ?? fallback,
        num: (flag, fallback) => finiteOr(get(flag), fallback),
        list: (flag, fallback) => (get(flag) ?? fallback.join(',')).split(',').filter(Boolean),
    };
}
/** Whether the caller wants JSON output (`--json` flag or non-TTY stdout). */
export const jsonMode = (argv) => parseFlags(argv).has('--json') || !process.stdout.isTTY;
