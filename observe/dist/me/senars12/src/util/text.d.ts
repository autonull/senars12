/** The one event shape that carries chat text; a stream is otherwise passed through. */
export type TextDeltaCarrier = {
    readonly kind: string;
    readonly text?: string;
};
/**
 * One event's contribution to a chat answer. Five sites summed `text-delta` events
 * by hand and two of them omitted the empty-text guard, so a delta with no text
 * appended the literal `"undefined"` to a model answer.
 */
export declare const appendTextDelta: (text: string, event: TextDeltaCarrier) => string;
/**
 * Drain a stream into its text, forwarding every event to {@link onEvent} — a
 * consumer that both relays the stream and wants the answer reads one pass. A
 * consumer that relays through `yield` accumulates with {@link appendTextDelta}.
 */
export declare const collectText: <T extends TextDeltaCarrier>(stream: AsyncIterable<T>, onEvent?: (event: T) => void) => Promise<string>;
/** Cut to `maxLength`, marking what the cut hid — the shortest of the three. */
export declare const truncate: (text: string, maxLength?: number) => string;
/** Byte-safe truncation for tool output — never splits a multi-byte character. */
export declare const truncateBytes: (text: string, maxBytes: number) => {
    text: string;
    truncated: boolean;
};
/** `items` through `format`, with a trailing count of what the limit hid. */
export declare const limitList: <T>(items: T[], limit: number, format: (item: T) => string, moreText?: string) => string[];
/**
 * Case-preserving word tokens. The one split: an empty or whitespace-only string
 * yields no tokens, which `String.split(/\s+/)` does not do — it yields `['']`,
 * and every caller that read `parts[0]` off that had to guard against the empty
 * string instead of against absence.
 */
export declare const splitWords: (text: string, splitPattern?: RegExp) => string[];
/**
 * Trimmed, non-empty lines. The one line split: `String.split('\n')` yields a
 * trailing `''` for text ending in a newline and leaves indentation on every
 * other line, so four sites each re-stated "trim each, drop the blanks".
 */
export declare const splitLines: (text: string) => string[];
/**
 * Escape every regexp metacharacter in `text`, so untrusted text becomes a
 * literal match instead of a pattern. Building a `RegExp` from unescaped input
 * is not a formatting convenience — it lets the input widen the match past its
 * own bounds — so this exists as the one spelling of "literal".
 */
export declare const escapeRegExp: (text: string) => string;
/** Lowercased word-token set — the tokenizer behind every text-similarity path. */
export declare const tokenizeWords: (text: string, splitPattern?: RegExp) => Set<string>;
/**
 * The separators between the words of a *term* rather than of prose. Three
 * similarity paths each declared their own character class and none agreed on
 * whether a Narsese arrow is one word or two; a term's words are the grammar's,
 * so the set is the grammar's and the three read it from here.
 */
export declare const TERM_SEPARATORS: RegExp;
/** How many of `needle`'s words appear in `haystack` — the numerator every
 *  overlap ratio is, and the form a caller holding one precomputed set needs. */
export declare const overlapCount: (needle: ReadonlySet<string>, haystack: ReadonlySet<string>) => number;
export declare const wordOverlap: (a: string, b: string, splitPattern?: RegExp) => number;
/** The leading run of atom characters in `content`, or nothing if it starts with none. */
export declare const extractTerm: (content: string) => string | undefined;
/** Whether `text` is Narsese rather than prose — the router between the two parsers. */
export declare function isNarsese(text: string): boolean;
/**
 * Case-insensitive substring test. Term matching, episodic recall and the MCP
 * belief search each spelled `x.toLowerCase().includes(y.toLowerCase())`, which
 * folded the needle once per element of a scan; fold it once with
 * {@link foldNeedle} and test with this.
 */
export declare const containsFolded: (haystack: string, lowerNeedle: string) => boolean;
/** The case-folded needle {@link containsFolded} expects. */
export declare const foldNeedle: (needle: string) => string;
/** Elements of `items` whose text contains `needle`, folded once. */
export declare const filterFolded: <T>(items: Iterable<T>, needle: string, textOf: (item: T) => string) => T[];
//# sourceMappingURL=text.d.ts.map