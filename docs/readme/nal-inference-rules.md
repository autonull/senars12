### NAL Inference Rules

<details>
<summary><b>Complete NAL Rule Matrix — generated from the loaded rule table, not transcribed</b></summary>

<!-- rule-matrix -->

The rule set is **loaded data, not an import side effect** (the loaded-data rule spec §5.10). The matrix above is a
projection of `BUILTIN_DECLARATIONS` (`nar/src/rules/impls/registration.ts`) rendered by
`pnpm rule:matrix`, so a rule cannot be added, renamed or removed without this table changing in
the same commit. A rule is a *declaration* — pattern, truth function, priority, and a **named body**
— and the body resolves at load time; a name nothing implements is refused loudly rather than
admitted as a rule that derives nothing. The loaded table is versioned, enumerable at runtime, and
revertable: `nar.getRuleTable()` returns the store, an admitted rule enters at a boundary with a
`ruleSetRevision` and a `provenance`, and an empty table is a runnable state rather than a crash.
`pnpm rules:loaded-data` is the gate.

</details>
