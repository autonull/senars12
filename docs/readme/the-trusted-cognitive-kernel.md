## The Trusted Cognitive Kernel

SeNARS separates *how cognition is produced* from *how it becomes state*. Three layers, and the
boundary between them is mechanical rather than a matter of trust:

- **System 1 — statistical proposers.** LLM translation, the calibrated Judgment Manifold, and
  reflex policies. Pattern-matching subsystems; useful, but never a source of logical truth.
- **System 2 — symbolic reasoning.** NAL inference and MeTTa exact computation. Conclusions are
  *derived* under truth-value algebra, and every derivation carries a trace.
- **Kernel gates — governance, neither system.** Perception, Action, Reward, and Budget gates
  mediate *every* state mutation, from either system, and are the only writer to the event log.

The rule that draws the line: **if it runs on embeddings, learned heads, Brier scores, or LM
calls, it is System 1; if it runs on NAL truth-value algebra, inference rules, or MeTTa rewriting,
it is System 2; the gates are governance and belong to neither.**

```
┌─────────────────────────────────────────────────────────────────────┐
│            SYSTEM 1 — UNTRUSTED PROPOSERS (statistical)             │
│ ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐ │
│ │ LLM (System 1)    │  │ Judgment Manifold │  │ Reflexes          │ │
│ │ Translate &       │  │ (System 1)        │  │ (System 1)        │ │
│ │ enrich natural    │  │ Calibrated heads: │  │ Fast policies:    │ │
│ │ language into     │  │ ambiguity,        │  │ tabular Q, UCB,   │ │
│ │ Narsese / MeTTa   │  │ injection risk    │  │ priority picks    │ │
│ └───────────────────┘  └───────────────────┘  └───────────────────┘ │
│                                 │ (scored proposals)                │
│                                 ▼                                   │
│              SYSTEM 2 — SYMBOLIC REASONING (auditable)              │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │ NAL Inference Engine        │   │ MeTTa Exact Computation     │  │
│  │ (System 2)                  │   │ (System 2)                  │  │
│  │ Uncertain logic,            │   │ E-graphs, rewriting,        │  │
│  │ truth-value algebra,        │   │ dependent types,            │  │
│  │ deduction, induction,       │   │ pattern matching,           │  │
│  │ abduction, traces           │   │ exact evaluation            │  │
│  └─────────────────────────────┘   └─────────────────────────────┘  │
│                                 │ (derivations, still untrusted)    │
│                                 ▼                                   │
├═════════════════════════════════════════════════════════════════════┤
│             KERNEL GATES — GOVERNANCE (neither system)              │
│        PerceptionGate | ActionGate | RewardGate | BudgetGate        │
├═════════════════════════════════════════════════════════════════════┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ EVENT LOG (Append-Only) — Source of Truth for State         │    │
│  │ • Type & Schema Validation (Zod)   • Evidence Independence  │    │
│  │ • Budget Accounting & Throttling   • Derivation Verifier    │    │
│  │ • Policy Enforcement               • Capability Sandboxing  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

Two properties the diagram encodes deliberately:

- **System 2 is not automatically trusted.** A derivation is only a *candidate*; it reaches the
  event log through the same gates a System 1 proposal does. The epistemic boundary is enforced by
  the gates, not by the producing subsystem's label.
- **The Judgment Manifold is inside System 1.** It is the disciplined half of System 1 — calibrated,
  digested, and auditable, but built on embeddings and learned heads, so it scores meaning rather
  than deriving it. It refines *what a proposal says*; it never becomes the reason a conclusion
  holds.