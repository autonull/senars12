/**
 * Filesystem primitives for append-only logs and small state files — the single
 * implementation of "ensure the directory, write/read JSON, append a JSONL
 * row" used across kernel, core, io, metta, and the bins.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { collectUpTo } from './collections';
/**
 * Accepted rows a reader stops at. `Infinity` reads the file whole.
 *
 * A cap has to reach the *walk*, not the caller. Every reader here collects into
 * an array first and the caller slices afterwards, so `readJsonl(path, parse)`
 * with a caller who wants five rows parsed and retained ten thousand — and the
 * log files are capped at ten thousand rows each. Applied inside the walk the
 * same query parses five.
 */
export const ALL_ROWS = Number.POSITIVE_INFINITY;
/** `mkdir -p`, returning the directory. */
export function ensureDirSync(dir) {
    mkdirSync(dir, { recursive: true });
    return dir;
}
/** `mkdir -p` for a file's parent directory. */
export function ensureParentDirSync(filePath) {
    return ensureDirSync(dirname(filePath));
}
export async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
    return dir;
}
export async function ensureParentDir(filePath) {
    return ensureDir(dirname(filePath));
}
/**
 * True when `candidate` is `root` itself or lies beneath it. Separators are
 * normalized to `/` and trailing ones dropped, so a sibling that merely shares
 * a name prefix (`/ws` vs `/ws-evil`) is rejected. The single path-containment
 * predicate behind the motor workspace, the WASI sandbox, and the fs tool scope.
 */
export const containsPath = (root, candidate) => {
    const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    const r = norm(root);
    const c = norm(candidate);
    return c === r || c.startsWith(r === '/' ? '/' : `${r}/`);
};
/** Parse JSON text, yielding `fallback` on any syntax error. */
export const parseJsonOr = (text, fallback) => {
    try {
        return JSON.parse(text);
    }
    catch {
        return fallback;
    }
};
/** The on-disk shape of every JSON state file — one definition so it cannot drift per writer. */
const jsonDocument = (value) => JSON.stringify(value, null, 2);
/** The on-disk shape of every JSONL append: one row per line, trailing newline. */
export const jsonlPayload = (rows) => {
    let payload = '';
    for (const row of rows)
        payload += `${JSON.stringify(row)}\n`;
    return payload;
};
/** One row is one line — the payload of a single-row append, with no array to build. */
const jsonLine = (row) => `${JSON.stringify(row)}\n`;
/**
 * The one append: ensure the parent, write the framed payload, report the rows.
 * Every JSONL appender below is this plus a framing choice, so the repository has
 * a single place that writes to an append-only file.
 */
function writeRows(path, payload, rows) {
    ensureParentDirSync(path);
    appendFileSync(path, payload);
    return rows;
}
/** {@link writeRows}, awaited. */
async function writeRowsAsync(path, payload, rows) {
    await ensureParentDir(path);
    await appendFile(path, payload);
    return rows;
}
/** Read and parse a JSON file. A missing or unreadable file yields `fallback`. */
export async function readJsonFile(path, fallback) {
    try {
        return parseJsonOr(await readFile(path, 'utf8'), fallback);
    }
    catch {
        return fallback;
    }
}
export function readJsonFileSync(path, fallback) {
    try {
        return parseJsonOr(readFileSync(path, 'utf8'), fallback);
    }
    catch {
        return fallback;
    }
}
/** Write a JSON file, creating parent directories. */
export async function writeJsonFile(path, value) {
    await ensureParentDir(path);
    await writeFile(path, jsonDocument(value), 'utf8');
}
export function writeJsonFileSync(path, value) {
    ensureParentDirSync(path);
    writeFileSync(path, jsonDocument(value), 'utf8');
}
/** Append `rows` as one JSON object per line. Returns the number appended. */
export function appendJsonl(path, rows) {
    return rows.length === 0 ? 0 : writeRows(path, jsonlPayload(rows), rows.length);
}
/**
 * {@link appendJsonl} for the one-row append — the event log's write, the
 * ledger's append, a trajectory cycle. Each of those spelled the batch call as
 * `appendJsonl(path, [row])`, so every single append built a row array, mapped
 * it to strings and joined it back to one line: three allocations and a callback
 * per event to emit one line. Here the payload is the line.
 */
export const appendJsonlRow = (path, row) => writeRows(path, jsonLine(row), 1);
/** {@link appendJsonlRow}, awaited. */
export const appendJsonlRowAsync = async (path, row) => writeRowsAsync(path, jsonLine(row), 1);
/** Rewrite a JSONL file from `rows` (compaction path). */
export async function writeJsonl(path, rows) {
    await ensureParentDir(path);
    if (rows.length === 0) {
        await writeFile(path, '', 'utf8');
        return;
    }
    await writeFile(path, jsonlPayload(rows), 'utf8');
}
export async function appendJsonlAsync(path, rows) {
    return rows.length === 0 ? 0 : writeRowsAsync(path, jsonlPayload(rows), rows.length);
}
/** Parse one JSONL line; `null` marks a line `parse` rejects, `FAIL` a syntax error. */
const FAIL = Symbol('jsonl-parse-failure');
const parseLine = (line, parse) => {
    try {
        return parse(JSON.parse(line));
    }
    catch {
        return FAIL;
    }
};
/**
 * The single line-walk behind every JSONL reader: blank lines are skipped, unparseable ones counted.
 *
 * Lines are cut with `indexOf` rather than `split('\n')` so the walk allocates
 * nothing beyond the row it is yielding — which is what lets {@link ALL_ROWS}'s
 * cap, or a caller stopping early, cost what it read instead of what the file
 * holds.
 */
function* walkJsonl(content, parse) {
    for (let start = 0; start <= content.length;) {
        const end = content.indexOf('\n', start);
        const trimmed = content.slice(start, end < 0 ? content.length : end).trim();
        // `+ 1` past the length on the last segment, so an unterminated final line
        // advances the cursor instead of re-cutting it forever.
        start = end < 0 ? content.length + 1 : end + 1;
        if (trimmed)
            yield parseLine(trimmed, parse);
    }
}
/** Absent content is empty content: append-only sinks start empty. */
const readContent = async (path) => {
    try {
        return await readFile(path, 'utf8');
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return '';
        throw e;
    }
};
/** The one accumulate step behind every JSONL reader: rows kept in order, the rest counted. */
const collectJsonl = (content, parse, limit) => {
    let invalid = 0;
    const rows = collectUpTo(walkJsonl(content, parse), limit, (row) => {
        if (row === null || row === FAIL) {
            invalid++;
            return undefined;
        }
        return row;
    });
    return { rows, invalid };
};
/**
 * Read a JSONL file, keeping rows that `parse` accepts and counting the rest.
 * A missing file is an empty log, not an error — append-only sinks start empty.
 */
export function readJsonl(path, parse, limit = ALL_ROWS) {
    if (limit <= 0)
        return { rows: [], invalid: 0 };
    if (!existsSync(path))
        return { rows: [], invalid: 0 };
    return collectJsonl(readFileSync(path, 'utf8'), parse, limit);
}
/**
 * {@link readJsonl} for the case where every row must satisfy one schema.
 *
 * Every persisted log — the event log, the derivation records — validates each
 * row against a schema and drops what fails, and each had written the same
 * `safeParse` ternary as its parse function. That ternary is the definition of
 * the round trip: a row that parses back differently from what was written is a
 * row that never existed, and it belongs in `invalid`, not in `rows`.
 */
export function readJsonlWith(path, schema, limit = ALL_ROWS) {
    return readJsonl(path, (value) => {
        const parsed = schema.safeParse(value);
        return parsed.success ? parsed.data : null;
    }, limit);
}
export async function readJsonlAsync(path, parse, limit = ALL_ROWS) {
    if (limit <= 0)
        return { rows: [], invalid: 0 };
    return collectJsonl(await readContent(path), parse, limit);
}
/** Stream a JSONL file row by row, yielding `undefined` for unreadable lines. */
export async function* iterateJsonl(path, parse) {
    for (const row of walkJsonl(await readContent(path), parse)) {
        yield row === FAIL ? undefined : (row ?? undefined);
    }
}
