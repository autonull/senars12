### Implementation Philosophy: Type-Driven Invariants

> **TypeScript enforces internal representational invariants at compile-time, while runtime schemas (e.g., Zod) enforce operational invariants at untrusted boundaries.**

By encoding NAL semantics at the type level:
- Derivation lineage capped at runtime (ancestor-set bound)
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource limits carried in typed configs

This eliminates entire classes of bugs at compile time and guarantees structural correctness by construction; AIKR bounds the remaining, resource-level dimension at runtime.
