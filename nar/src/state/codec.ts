import { SenarsError } from '@senars/util/errors';

/**
 * StateCodec (TODO20 X7) — one schema-pinned, versioned envelope for persisted
 * state files. Consumers: NAR snapshot (StatePersister) and memory state
 * serialization. Event-log persistence stays line-delimited JSONL validated
 * per-line by CognitiveEventSchema — same pinning, different medium.
 */

export const STATE_CODEC_FORMAT = 'senars.state';

export interface StateEnvelope<T = unknown> {
  format: typeof STATE_CODEC_FORMAT;
  /** Logical state kind, e.g. 'nar.beliefs' | 'nar.drives' | 'memory.state'. */
  kind: string;
  /** Payload schema version. */
  version: number;
  payload: T;
}

export const encodeState = <T>(kind: string, version: number, payload: T): string =>
  JSON.stringify({ format: STATE_CODEC_FORMAT, kind, version, payload } satisfies StateEnvelope<T>);

/**
 * Decode a state file. Accepts both envelope-wrapped and legacy (bare payload)
 * content so old files keep loading. Envelopes are strictly validated: format
 * and kind must match, and a version mismatch fails loudly.
 */
export const decodeState = <T>(
  text: string,
  kind: string,
  currentVersion: number,
  acceptedVersions: readonly number[] = [currentVersion]
): T => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw SenarsError.wrap(e, { kind, operation: 'decodeState.parse' });
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'format' in parsed &&
    (parsed as StateEnvelope).format === STATE_CODEC_FORMAT
  ) {
    const envelope = parsed as StateEnvelope;
    if (envelope.kind !== kind) {
      throw new Error(
        `State kind mismatch: expected "${kind}", got "${envelope.kind}" (corrupt or wrong file)`
      );
    }
    if (!acceptedVersions.includes(envelope.version)) {
      throw new Error(
        `Unsupported state version ${envelope.version} for "${kind}" (supported: ${acceptedVersions.join(', ')})`
      );
    }
    return envelope.payload as T;
  }
  return parsed as T;
};
