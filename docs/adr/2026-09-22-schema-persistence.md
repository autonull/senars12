# ADR: Versioned Schema-Pinned Envelope for Persisted State

## Status

Accepted

## Date

2026-09-22

## Context

Persisted state (beliefs, drives, gate logs) is read back by later versions
of the code. Bare JSON payloads carry no schema identity, so a version
mismatch or wrong-kind file silently loads as garbage — the worst failure
mode for a reasoning system whose history is its knowledge.

## Decision

All persisted state passes through `StateCodec` (`nar/src/state/codec.ts`):

- `encodeState(kind, version, payload)` emits JSON envelope
  `{ format: 'senars.state', kind, version, payload }` (`STATE_CODEC_FORMAT`
  = `'senars.state'`).
- `decodeState(content, kind, acceptedVersions)` strictly validates
  envelopes: format must match, `kind` must match (mismatch = corrupt/wrong
  file, loud failure), version must be in `acceptedVersions`.
- Backward compatibility: bare-payload (legacy, pre-envelope) files still
  decode — legacy content is recognized by the absence of `format` and
  accepted with the caller's expected kind/version.

`nar/src/nar/persistence.ts` pins the current logical version as
`NAR_STATE_VERSION = 1` and encodes/decodes all NAR state through the codec.
Gate/event logs additionally have a documented third path: JSONL append via
`replay.ts` (`appendFileSync` of one JSON object per line), used for
append-only event streams and `replayCognitiveState` snapshots
(`SNAPSHOT_VERSION = 1`).

## Consequences

- Every load either succeeds against a pinned schema or fails loudly; silent
  corruption is structurally excluded for envelope files.
- Version migrations are explicit: bump `NAR_STATE_VERSION`, add the old
  version to `acceptedVersions` during the compat window, retire it in a
  major per the deprecation policy.
- Legacy bare-payload reading is a transition path only; new writers always
  emit envelopes.
- JSONL event logs are append-only by design — compaction is a separate
  concern (`agent/compaction.ts`).

## References

- `nar/src/state/codec.ts`
- `nar/src/nar/persistence.ts`
- `nar/src/kernel/replay.ts`
- `nar/src/kernel/EventLogPersistence.ts`
