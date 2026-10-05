### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAR REASONER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  BELIEFS    │  │   GOALS     │  │  QUESTIONS  │              │
│  │  (incl.     │  │  (incl.     │  │  (incl.     │              │
│  │   self-     │  │   self-     │  │   self-     │              │
│  │   beliefs)  │  │   goals)    │  │   questions)│              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   RULE PROCESSOR    │  ← 5 meta-rules + AIKR bounds│
│              │                     │  ← sync rules + LMRules      │
│              └──────────┬──────────┘                            │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                  │
│    ▼                    ▼                    ▼                  │
│ ┌─────────┐       ┌─────────┐        ┌─────────┐              │
│ │ TOOLS   │       │ MEMORY  │        │ RLFP    │              │
│ │(self-ops)│       │(self-epi)│        │(task rwd)│             │
│ └─────────┘       └─────────┘        └─────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**The Cognitive Loop — Two Levels:**

- **Kernel Micro-Tick** (the 6 traced stages, `CYCLE_STAGES`): `perceive | attend | reason | authorize | propose | learn` — the kernel's inner loop, running inside `NARExecution.run()`; each region is recorded by `CycleTrace`.
- **Agent Macro-Cycle** (`DEFAULT_MACRO_PIPELINE`, 8 phases): `Perceive → Recall → Reason → Narrate → Consolidate → Act → Record → Announce` — the Agent wraps the Kernel, adding "Narrate" (LLM Cortex synthesis) and the Record/Announce tail.

The self-improvement loop operates at the kernel level: `Perceive → Recall → Reason (meta-rules + drives) → Act (tools) → Record → Consolidate`.
