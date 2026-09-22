# Schema Store Corruption / State Envelope Mismatch

## Symptom

- Agent starts with an empty schema store despite prior episodes ("fresh agent, no lies")
  — the store loads fail-closed (`nar/src/focus/schema-store.ts:45`).
- `StateKindMismatchError` / `StateVersionError` from `decodeState`
  (`nar/src/state/codec.ts:50,53`): `"State kind mismatch: expected ..."` or
  `"Unsupported state version ... for ..."`.
- `SenarsError` with `operation: 'decodeState.parse'` (JSON parse failure on a state file).
- OTel span `schema_store.promote` (`schema-store.ts:33`) failing or showing zero counts.

## Diagnosis

```sh
# Locate state dir files (StatePersister, nar/src/nar/persistence.ts)
# beliefs.json goals.json questions.json attention.json drives.json lm-rules.json
ls -la <state-dir>

# Validate envelope structure: { format, kind, version, payload }
head -c 200 <state-dir>/beliefs.json

# Check schema-store sidecar (separate file next to state, promoted schemas keyed
# scope::action::kind, schema-store.ts:24)
head -c 200 <schema-sidecar-path>
```

- Envelope contract: `format: STATE_CODEC_FORMAT`, `kind` must match the expected kind
  (`nar.beliefs`, `nar.goals`, `nar.questions`, `nar.attention`, `nar.drives`,
  `nar.lm-rules` — see `persistence.ts:96-101`), `version` must be in
  `NAR_STATE_VERSION = 1` accepted set (`persistence.ts:15`).
- Legacy bare-payload (non-envelope) files are accepted by `decodeState`; corruption
  means truncated/partial JSON or a wrong-kind file, not old format.
- Truncated writes are the usual cause: process killed mid `writeFile`
  (`persistence.ts:106-107` writes all files concurrently, no atomic rename).

## Remediation

1. Confirm which file is bad: the error path/context names `kind` and operation.
2. Move the corrupt file aside (rename to `<name>.corrupt-<timestamp>`); the loader
   treats it as absent and the agent re-bootstraps.
3. Schema-store sidecar corrupt: delete it — fail-closed load yields an empty store
   and re-promotion from subsequent episodes repopulates it.
4. If all state is lost but episodes matter, restore from backup; payload shape must
   match the snapshot kind (belief/goal/question arrays, drive maps).
5. Re-run the workload; `SchemaStore.promote` re-stores on each promotion
   (keyed `(scope, action, kind)`), so data rebuilds organically.

## Escalation / Rollback

- No automatic rollback: state files are last-write-wins. If corruption recurs,
  investigate disk/IO or concurrent writers (two processes sharing one state dir)
  before restoring.
- Rollback path: restore the previous snapshot files and keep `NAR_STATE_VERSION`
  consistent — a version downgrade triggers `Unsupported state version` by design;
  migrate the payload instead of editing the version field.