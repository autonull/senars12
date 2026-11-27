import { SenarsError } from '../errors';
/**
 * StateCodec (TODO20 X7) — one schema-pinned, versioned envelope for persisted
 * state files. Consumers: NAR snapshot (StatePersister) and memory state
 * serialization. Event-log persistence stays line-delimited JSONL validated
 * per-line by CognitiveEventSchema — same pinning, different medium.
 */
export const STATE_CODEC_FORMAT = 'senars.state';
/**
 * The one schema version for state files that cross the persistence boundary
 * (CORE.19 C4.2). The task/drive files (`NAR_STATE_VERSION`), the memory dump
 * (`MEMORY_VERSION`) and the boundary file all read this constant, so a version
 * bump is a single edit and one documented migration or refusal, not three
 * independent axes that can disagree.
 */
export const NAR_STATE_SCHEMA_VERSION = 1;
export const encodeState = (kind, version, payload) => JSON.stringify({ format: STATE_CODEC_FORMAT, kind, version, payload });
/**
 * Decode a state file. Accepts both envelope-wrapped and legacy (bare payload)
 * content so old files keep loading. Envelopes are strictly validated: format
 * and kind must match, and a version mismatch fails loudly.
 */
export const decodeState = (text, kind, currentVersion, acceptedVersions = [currentVersion]) => {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (e) {
        throw SenarsError.wrap(e, { kind, operation: 'decodeState.parse' });
    }
    if (parsed &&
        typeof parsed === 'object' &&
        'format' in parsed &&
        parsed.format === STATE_CODEC_FORMAT) {
        const envelope = parsed;
        if (envelope.kind !== kind) {
            throw new SenarsError(`State kind mismatch: expected "${kind}", got "${envelope.kind}" (corrupt or wrong file)`, 'VALIDATION_ERROR');
        }
        if (!acceptedVersions.includes(envelope.version)) {
            throw new SenarsError(`Unsupported state version ${envelope.version} for "${kind}" (supported: ${acceptedVersions.join(', ')})`, 'OPERATION_ERROR');
        }
        return envelope.payload;
    }
    return parsed;
};
