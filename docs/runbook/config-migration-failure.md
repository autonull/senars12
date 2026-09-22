# Config Migration Failure (senars.config.json)

## Symptom

- Startup warning/error: `configVersion "X" is newer than supported (2.0)` —
  config written by a newer build (`nar`-side `migrateConfig` blocked path,
  `src/utils/config-migrate.ts:62-66`).
- `no migration path from config version N` — a major version with no entry in
  `MIGRATIONS` (`src/utils/config-migrate.ts:70`).
- Config silently migrated on start: log shows applied steps `['1→2']` and the file
  was rewritten (auto write-back, best-effort — see module header
  `config-migrate.ts:1-7`).
- `pnpm config:check` (package.json:22 → `src/utils/config-check.ts`) failing.

## Diagnosis

```sh
# Current version + migration chain
grep -n CURRENT_CONFIG_VERSION MIGRATIONS src/utils/config-migrate.ts | head

# What's on disk
cat senars.config.json | head -20
python3 -c "import json;print(json.load(open('senars.config.json')).get('configVersion'))"

# Run the checker
pnpm config:check
```

- The only registered transform is v1→v2 (`MIGRATIONS['1']`,
  `config-migrate.ts:18`): flat `model`/`provider` move under a new `lm` block,
  `configVersion` stamped `2.0` (`CURRENT_CONFIG_VERSION`, line 11).
- Missing/unparseable `configVersion` is auto-stamped to current and validated
  (`config-migrate.ts:60-64`) — not an error.
- `majorOf` (`config-migrate.ts:56`) parses the leading integer; junk like
  `"2.x-beta"` blocks migration.

## Remediation

1. Newer config than the binary: either upgrade the package or hand-edit
   `senars.config.json` down to a supported major (`configVersion: "2.0"`) and
   flatten any future-only keys.
2. Unknown major (no migration path): inspect the diff between that major's layout
   and current, add the missing `MIGRATIONS` entry, or restore a matching-config
   backup.
3. Malformed JSON: restore from backup; migration runs only after a successful
   parse in `migrateConfigFile` (`config-migrate.ts:87`).
4. Write-back failed (read-only FS / permissions): the migration still applies
   in-memory for the session — fix file permissions so the on-disk format catches up,
   or every start will re-migrate.
5. Validate the result: `pnpm config:check` must pass before restart.

## Escalation / Rollback

- Rollback: keep a pre-migration copy (`cp senars.config.json senars.config.json.bak`)
  before hand-editing; the migrated form is functionally equivalent for v1→v2
  (`lm.model`/`lm.provider` are the only moves), so downgrading means restoring the
  flat keys and `configVersion: "1"`.
- If a new major requires a migration transform that doesn't exist yet, escalate to
  the config owner to add a `MIGRATIONS` entry (ordered chain, one entry per major).