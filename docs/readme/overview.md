# **Semantic Non-Axiomatic Reasoning System** (SeNARS)

SeNARS is a bounded, event-sourced cognitive runtime designed for auditable, continuous operation. It provides a hardened execution kernel that synthesizes uncertain symbolic inference (Non-Axiomatic Logic), exact algebraic rewriting (MeTTa), and optional neural-assisted formalization into a unified, provenance-preserving state machine.

Rather than treating language models as standalone reasoning engines, SeNARS integrates them as untrusted "System 1" proposers within a broader cognitive architecture. Every proposer output — translations, synthesized candidates, policy scores — is judged by a calibrated **Judgment Manifold** before it can influence state. The SeNARS kernel acts as the "System 2" source of truth, enforcing strict epistemic boundaries, resource limits, and structural invariants.

* **Event-Sourced Provenance:** Every cognitive mutation is an append-only event, enabling deterministic replay, standalone verification, and complete derivation tracing.
* **Bounded Cognition (AIKR):** Built on the Assumption of Insufficient Knowledge and Resources. The system utilizes bounded priority bags, cooperative yielding, and anytime algorithms to ensure graceful degradation under memory or CPU pressure.
* **Epistemic Firewall:** A strict structural and type-level separation between *Beliefs* (epistemic truth) and *Goals* (teleological desire), preventing reward signals from corrupting factual confidence.
* **Type-Driven Invariants:** TypeScript enforces internal representational invariants at compile-time, while runtime schemas (Zod) enforce operational invariants at untrusted boundaries.
