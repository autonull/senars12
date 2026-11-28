/**
 * StateCodec (TODO20 X7) — one schema-pinned, versioned envelope for persisted
 * state files. Consumers: NAR snapshot (StatePersister) and memory state
 * serialization. Event-log persistence stays line-delimited JSONL validated
 * per-line by CognitiveEventSchema — same pinning, different medium.
 */
export declare const STATE_CODEC_FORMAT = "senars.state";
/**
 * The one schema version for state files that cross the persistence boundary
 * (CORE.19 C4.2). The task/drive files (`NAR_STATE_VERSION`), the memory dump
 * (`MEMORY_VERSION`) and the boundary file all read this constant, so a version
 * bump is a single edit and one documented migration or refusal, not three
 * independent axes that can disagree.
 */
export declare const NAR_STATE_SCHEMA_VERSION = 1;
export interface StateEnvelope<T = unknown> {
    format: typeof STATE_CODEC_FORMAT;
    /** Logical state kind, e.g. 'nar.beliefs' | 'nar.drives' | 'memory.state'. */
    kind: string;
    /** Payload schema version. */
    version: number;
    payload: T;
}
export declare const encodeState: <T>(kind: string, version: number, payload: T) => string;
/**
 * Decode a state file. Accepts both envelope-wrapped and legacy (bare payload)
 * content so old files keep loading. Envelopes are strictly validated: format
 * and kind must match, and a version mismatch fails loudly.
 */
export declare const decodeState: <T>(text: string, kind: string, currentVersion: number, acceptedVersions?: readonly number[]) => T;
//# sourceMappingURL=codec.d.ts.map