### Implementation Philosophy: Type-Driven Invariants

> **TypeScript enforces internal representational invariants at compile-time, while runtime schemas (e.g., Zod) enforce operational invariants at untrusted boundaries.**

By encoding NAL semantics at the type level:
- Derivation lineage capped at runtime (ancestor-set bound)
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource limits carried in typed configs

This eliminates entire classes of bugs at compile time and guarantees structural correctness by construction; AIKR bounds the remaining, resource-level dimension at runtime.

**One vocabulary of values a boundary admits.** A Zod schema here is a boundary — a gate
IO, a persisted record, a config read off disk, a tool argument from a model — and every
schema is assembled from fragments declared once in `util/src/config/boundary.ts`:

| Fragment | Admits |
|---|---|
| `nonEmpty` | a string with content — a rule id, an artifact version, a lens label |
| `uuid` | a minted identifier; `makeId` mints them and a seeded run mints UUID-shaped counters |
| `nonNegativeInt` / `positiveInt` | a count, and whether zero is one of its values |
| `timestamp` | wall-clock milliseconds — a position on a clock, not a quantity |
| `intBetween(lo, hi)` / `intAtLeast(lo)` | a bound the caller chose |
| `unitInterval` / `signedUnitInterval` | a probability or a rate; a signed score |

Those fragments were spelled inline 143 times, and every spelling was correct — which was
the problem. A rule id that admitted the empty string on one edge and refused it on the
next was not a bug anyone could find locally; it was a boundary whose strictness was a
property of which file happened to declare the field. And a fragment spelled inline cannot
be widened once, because there is no once. `pnpm schema:grammar` is the third member of the
grammar family (`env:grammar`, `primitives:grammar`) and fails on the inline spelling, with
a `DECLARED` ledger for the sites that must spell a bound themselves.