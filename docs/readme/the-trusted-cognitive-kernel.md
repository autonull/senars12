## The Trusted Cognitive Kernel

```
┌─────────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED PROPOSERS                            │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────────┐   │
│  │ LLM (S1) │   │ NAR Engine   │   │ Reflexes                   │   │
│  │(Translate│   │(Uncertain    │   │(Fast S1                    │   │
│  │ & Enrich)│   │  Inference)  │   │ Policies)                  │   │
│  └────┬─────┘   └──────┬───────┘   └────────────┬───────────────┘   │
│       │                │                        │                  │
│       └────────────────┴────────────────────────┘                  │
│                                │ (Proposals / Tool Requests)        │
│                                ▼                                    │
├════════════════════════════════════════════════════════════════════════┤
│  GATES: PerceptionGate | ActionGate | RewardGate | BudgetGate       │
├════════════════════════════════════════════════════════════════════════┤
│                     TRUSTED COGNITIVE KERNEL                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  EVENT LOG (Append-Only)  <-- Source of Truth for State       │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  • Type & Schema Validation (Zod)   • Evidence Independence  │  │
│  │  • Budget Accounting & Throttling   • Derivation Verifier    │  │
│  │  • Policy Enforcement               • Capability Sandboxing  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```
