# ADR: Fluent Builder for NAR Construction

## Status

Accepted

## Date

2026-09-22

## Context

A wired `NAR` involves gates, profiles, capabilities, System One tier, and
config — too many concerns for a single constructor to take positionally
without becoming an unreadable options blob. Wiring errors (missing gate,
conflicting profile) should fail with precise, attributable diagnostics
rather than at first use.

## Decision

`NARBuilder` (`nar/src/agent/builder.ts`) is the sole supported construction
path for a wired agent:

- Fluent, chainable setters (`withProfile`, capability setters, escape hatch
  for raw `NARConfig` fields — except `gateRegistry`, which is always owned
  by the builder).
- Profiles are data: `withProfile` seeds from named presets resolved via
  `resolveProfile` (`agent/profiles.ts`).
- `build()` is async and wraps the wiring in a span `nar.builder.build` with
  attributes `builder.profile`, `builder.capabilities`,
  `builder.system_one_tier`, `builder.gates_injected`.
- Failures throw `BuilderError` (extends `SenarsError`) carrying the failing
  step, so errors are attributable to a named wiring stage.

Factory presets in `nar/src/nar-presets.ts` (`createNAR`, `createBotNAR`,
`createMinimalNAR`, `createTestNAR`) delegate to the builder and exist only
as convenience entry points.

## Consequences

- One construction path: tests, bots, and presets converge on the builder,
  eliminating divergent wiring logic.
- `BuilderError.step` and the build span give direct diagnostics; wiring
  regressions surface at build time.
- Gate ownership by the builder prevents callers from injecting a
  nonstandard registry.
- Cost: builder API surface must be maintained; raw-config escape hatch is
  deliberate friction, kept last.

## References

- `nar/src/agent/builder.ts`
- `nar/src/agent/profiles.ts`
- `nar/src/agent/config.ts`
- `nar/src/nar-presets.ts`
