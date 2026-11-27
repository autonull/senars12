/**
 * Pulling a JSON object out of untrusted model text.
 *
 * Brace-balanced scanning replaces the greedy `/\{[\s\S]*\}/` regex that
 * previously ran at every call site: greedy matching swallowed trailing prose
 * and sibling objects, so any response with a `}` after the payload failed to
 * parse. Fenced blocks and prose around the object are tolerated.
 *
 * Pure, and therefore in `util` rather than in the induction layer: the cycle
 * path parses model output too, and a core that reaches into the layer to do it
 * is a boundary the gate would have to carve an exception for (TODO29.a §5.2).
 */
/** The first balanced top-level JSON object in `text`, or null. */
export declare function extractJsonObject(text: string): string | null;
/**
 * Parse the first JSON object in `text`; null when absent or malformed.
 * `T` names what the caller expects — it is asserted, not checked, so it belongs
 * on a boundary that already validates the document it read.
 */
export declare function parseJsonObject<T = unknown>(text: string): T | null;
/**
 * Deterministic JSON with object keys emitted in sorted order — the single
 * serializer behind every cache key and content digest, so two structurally
 * equal values always digest identically regardless of insertion order.
 * `undefined` members are dropped, matching `JSON.stringify`.
 *
 * `sortArrays` treats array order as non-semantic, so `{ filters: ['b','a'] }`
 * and `{ filters: ['a','b'] }` are one value. Use it only where a list is a
 * set — strategy config, filters, tags — never for an ordered sequence.
 *
 * For *equality* rather than a digest, use `deepEqual`, which answers the same
 * question without serializing the graph.
 */
export declare function stableStringify(value: unknown, sortArrays?: boolean): string;
/**
 * A cache key for any value, including one `stableStringify` cannot digest — a
 * cyclic graph, a function, a value with a throwing getter. The two memo sites
 * that needed this each wrote the same `try { stableStringify } catch { nonce }`
 * pair, so a memo silently lost its hit rate on exactly the inputs that were
 * hardest to debug.
 */
export declare function stableKeyOf(value: unknown, fallback: () => string, sortArrays?: boolean): string;
//# sourceMappingURL=json.d.ts.map