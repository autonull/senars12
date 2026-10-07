# **Semantic Non-Axiomatic Reasoning System** (SeNARS)

SeNARS is a bounded, event-sourced cognitive runtime designed for auditable, continuous operation. It provides a hardened execution kernel that synthesizes uncertain symbolic inference (Non-Axiomatic Logic), exact algebraic rewriting (MeTTa), and optional neural-assisted formalization into a unified, provenance-preserving state machine.

Rather than treating language models as standalone reasoning engines, SeNARS organizes cognition into two systems, with a governance layer enforcing the boundary between them:

- **System 1 — fast, statistical.** LLM proposers, reflex policies, and the calibrated **Judgment Manifold**, which judges every proposer output — translations, synthesized candidates, policy scores — from one context embedding. These are pattern-matching subsystems: useful, but never a source of logical truth. The Judgment Manifold is System 1 *with discipline*, not System 2 — its judgments are calibrated scores, not proofs.
- **System 2 — slow, symbolic.** The NAL inference engine and the MeTTa exact-computation substrate: deduction, induction, abduction, and algebraic rewriting under auditable truth-value algebra. This is where conclusions are *derived*.
- **Kernel gates — governance, neither system.** The Perception, Action, Reward, and Budget gates admit and record. Every state mutation passes through them — from System 1 or System 2 alike — enforcing strict epistemic boundaries, resource limits, and structural invariants.

System 1 *proposes*; System 2 *derives*; the gates *admit and record*.

* **Event-Sourced Provenance:** Every cognitive mutation is an append-only event, enabling deterministic replay, standalone verification, and complete derivation tracing.
* **Bounded Cognition (AIKR):** Built on the Assumption of Insufficient Knowledge and Resources. The system utilizes bounded priority bags, cooperative yielding, and anytime algorithms to ensure graceful degradation under memory or CPU pressure.
* **Epistemic Firewall:** A strict structural and type-level separation between *Beliefs* (epistemic truth) and *Goals* (teleological desire), preventing reward signals from corrupting factual confidence.
* **Type-Driven Invariants:** TypeScript enforces internal representational invariants at compile-time, while runtime schemas (Zod) enforce operational invariants at untrusted boundaries.
