/**
 * Filesystem primitives for append-only logs and small state files — the single
 * implementation of "ensure the directory, write/read JSON, append a JSONL
 * row" used across kernel, core, io, metta, and the bins.
 */
export interface JsonlLoadResult<T> {
    rows: T[];
    invalid: number;
}
/**
 * Accepted rows a reader stops at. `Infinity` reads the file whole.
 *
 * A cap has to reach the *walk*, not the caller. Every reader here collects into
 * an array first and the caller slices afterwards, so `readJsonl(path, parse)`
 * with a caller who wants five rows parsed and retained ten thousand — and the
 * log files are capped at ten thousand rows each. Applied inside the walk the
 * same query parses five.
 */
export declare const ALL_ROWS: number;
/** `mkdir -p`, returning the directory. */
export declare function ensureDirSync(dir: string): string;
/** `mkdir -p` for a file's parent directory. */
export declare function ensureParentDirSync(filePath: string): string;
export declare function ensureDir(dir: string): Promise<string>;
export declare function ensureParentDir(filePath: string): Promise<string>;
/**
 * True when `candidate` is `root` itself or lies beneath it. Separators are
 * normalized to `/` and trailing ones dropped, so a sibling that merely shares
 * a name prefix (`/ws` vs `/ws-evil`) is rejected. The single path-containment
 * predicate behind the motor workspace, the WASI sandbox, and the fs tool scope.
 */
export declare const containsPath: (root: string, candidate: string) => boolean;
/** Parse JSON text, yielding `fallback` on any syntax error. */
export declare const parseJsonOr: <T>(text: string, fallback: T) => T;
/** The on-disk shape of every JSONL append: one row per line, trailing newline. */
export declare const jsonlPayload: (rows: readonly unknown[]) => string;
/** Read and parse a JSON file. A missing or unreadable file yields `fallback`. */
export declare function readJsonFile<T>(path: string, fallback: T): Promise<T>;
export declare function readJsonFileSync<T>(path: string, fallback: T): T;
/** Write a JSON file, creating parent directories. */
export declare function writeJsonFile(path: string, value: unknown): Promise<void>;
export declare function writeJsonFileSync(path: string, value: unknown): void;
/** Append `rows` as one JSON object per line. Returns the number appended. */
export declare function appendJsonl(path: string, rows: readonly unknown[]): number;
/**
 * {@link appendJsonl} for the one-row append — the event log's write, the
 * ledger's append, a trajectory cycle. Each of those spelled the batch call as
 * `appendJsonl(path, [row])`, so every single append built a row array, mapped
 * it to strings and joined it back to one line: three allocations and a callback
 * per event to emit one line. Here the payload is the line.
 */
export declare const appendJsonlRow: (path: string, row: unknown) => number;
/** {@link appendJsonlRow}, awaited. */
export declare const appendJsonlRowAsync: (path: string, row: unknown) => Promise<number>;
/** Rewrite a JSONL file from `rows` (compaction path). */
export declare function writeJsonl(path: string, rows: readonly unknown[]): Promise<void>;
export declare function appendJsonlAsync(path: string, rows: readonly unknown[]): Promise<number>;
/**
 * Read a JSONL file, keeping rows that `parse` accepts and counting the rest.
 * A missing file is an empty log, not an error — append-only sinks start empty.
 */
export declare function readJsonl<T>(path: string, parse: (value: unknown) => T | null, limit?: number): JsonlLoadResult<T>;
/**
 * {@link readJsonl} for the case where every row must satisfy one schema.
 *
 * Every persisted log — the event log, the derivation records — validates each
 * row against a schema and drops what fails, and each had written the same
 * `safeParse` ternary as its parse function. That ternary is the definition of
 * the round trip: a row that parses back differently from what was written is a
 * row that never existed, and it belongs in `invalid`, not in `rows`.
 */
export declare function readJsonlWith<T>(path: string, schema: {
    safeParse: (value: unknown) => {
        success: true;
        data: T;
    } | {
        success: false;
    };
}, limit?: number): JsonlLoadResult<T>;
export declare function readJsonlAsync<T>(path: string, parse: (value: unknown) => T | null, limit?: number): Promise<JsonlLoadResult<T>>;
/** Stream a JSONL file row by row, yielding `undefined` for unreadable lines. */
export declare function iterateJsonl<T>(path: string, parse: (value: unknown) => T | null): AsyncGenerator<T | undefined>;
//# sourceMappingURL=fs.d.ts.map