# TODO32: Integration Milestones — A Working, Usable System

**Version:** 1.0 · **Status:** drafted 2026-10-02 · **Predecessor:** `TODO30.md` (v1.2 — correctness items landed) / `TODO31.md` (v1.0 — subsystem items) · **Supersedes:** both for execution purposes.

**Philosophy:** The architecture exists. Every subsystem has a green gate. What does not exist is *verified composition*. This plan replaces "fix the parts" with "connect the parts and prove they work together."

---

## Milestones

| # | milestone | one-line test | status |
|---|-----------|---------------|--------|
| **M1** | **End-to-end pipeline** | NL input → PerceptionGate → NAL → QueryAPI → NL output | not started |
| **M2** | **Egress judging** | System One judges NAL conclusions before admission | not started |
| **M3** | **MeTTa wired** | `metta` tool executes MeTTa program via ActionGate | not started |
| **M4** | **Crash/recovery** | Kill/restart NAR, verify event-log-replay = snapshot | not started |
| **M5** | **Reward→policy learning** | Reward signal changes action selection (not beliefs) | not started |
| **M6** | **Multi-agent delegation** | Agent A delegates cognitive task to Agent B | not started |
| **M7** | **Single config + docs** | One config file, 30-min "hello world" | not started |
| **M8** | **Derivation explainability** | `ask()` returns trace + premises + rules fired | not started |

---

## M1: End-to-End Pipeline

**The smoke test for the whole architecture.**

```typescript
// tests/nar/todo32-m1.test.ts
const nar = createNAR({ enableTools: true, systemOne: { enabled: true } });
await nar.start();

// 1. Natural language in
await nar.input("Cats are mammals. Whiskers is a cat.", 'belief');

// 2. PerceptionGate admits → NAL derives
await nar.run(10);

// 3. QueryAPI answers
const answer = await nar.askNaturalLanguage("What is Whiskers?");

// 4. Assert: answer contains "mammal", confidence > 0.5
expect(answer.text).toContain('mammal');
expect(answer.confidence).toBeGreaterThan(0.5);

// 5. Tool execution (bonus)
await nar.tools.execute('explain', { term: '(whiskers --> mammal)' });
```

**What this exposes:** PerceptionGate config, NL understanding service wiring, QueryAPI → NL generation, tool routing, System One ingress calibration.

**Depends on:** §4.3 T-J (J must admit for System One ingress), O6 (distillation not required but NL generation must work).

---

## M2: Egress Judging

**System One currently judges *ingress* (raw NL → task). It must also judge *egress* (NAL conclusion → belief).**

```typescript
// nar/src/kernel/KernelPerceptionGate.ts (add)
// Admit NAL-derived conclusions through the manifold before they become beliefs
async admitDerived(conclusion: Term, truth: Truth, derivation: DerivationRecord): Promise<JudgmentVerdict> {
  const judgment = await this.manifold.judgeBatch({
    space: 'epistemic',
    axis: 'groundedness',      // is this conclusion supported by the derivation?
    axis: 'risk',              // does it violate safety?
    axis: 'coherence',         // does it contradict existing beliefs?
    candidates: [{ term: conclusion, truth, derivation }],
  });
  return judgment.verdicts[0];
}
```

**Why this matters:** Without egress judging, the neural-symbolic loop is one-way. NAL derives → belief stored. With egress: NAL derives → manifold judges → *admitted/refused/revised* → belief stored. This is the "neural-assisted formalization" loop closed.

**Test:** Derive a contradiction via NAL → manifold vetoes admission. Derive a sound conclusion → manifold admits with calibrated truth.

---

## M3: MeTTa Wired

**The "exact computation substrate" is disconnected. `createAgent` declares `metta` tool but ActionGate doesn't route to MeTTa runtime.**

```typescript
// nar/src/tools/registry.ts (add)
import { createMeTTa } from '@senars/metta';

const mettaRuntime = createMeTTa();

toolRegistry.register({
  name: 'metta',
  schema: { program: z.string() },
  async execute({ program }) {
    const result = await mettaRuntime.evaluate(parseMeTTa(program));
    return { result: result.toString() };
  },
});
```

**Test:** `nar.tools.execute('metta', { program: '(add 1 2)' })` → returns `"3"`.

**Why this matters:** MeTTa provides *equality saturation* and *dependent types* — exact computation for when NAL's uncertain inference isn't enough. The ActionGate is the only path; if it doesn't route, MeTTa is dead code.

---

## M4: Crash/Recovery

**Event sourcing is the source of truth. The JSON snapshot (`nar-state`) is a checkpoint. Neither is tested.**

```typescript
// tests/nar/todo32-m4.test.ts
const nar1 = createNAR({ persistState: true, statePath: '/tmp/test-state' });
await nar1.start();
await nar1.input('(cat --> animal).', 'belief', Truth.create(0.9, 0.9));
await nar1.run(5);
const beliefs1 = nar1.getBeliefs().map(b => b.term.toString());
await nar1.dispose();

// Kill process, restart
const nar2 = createNAR({ persistState: true, statePath: '/tmp/test-state' });
await nar2.initialize(); // loads snapshot, replays event log
const beliefs2 = nar2.getBeliefs().map(b => b.term.toString());

expect(beliefs2).toEqual(beliefs1); // identical committed state
```

**What this validates:** Event log integrity, snapshot consistency, `StateCodec` versioning, concept/task serialization, `Memory` reconstruction.

---

## M5: Reward→Policy Learning

**The epistemic firewall blocks reward→Truth mutation. Learning *must* go through goals/policy. This has never been verified end-to-end.**

```typescript
// tests/nar/todo32-m5.test.ts
const nar = createNAR({ enableRLFP: true });
await nar.start();

// 1. Establish a goal
await nar.goal('(system --> operational)!');

// 2. Run cycles, observe action selection
const actionsBefore = await nar.tools.execute('getActionStats', {});

// 3. Deliver negative reward for the chosen action
await nar.input('(action-1 --> reward: -1.0).', 'belief', Truth.create(1.0, 0.9));

// 4. Run more cycles
await nar.run(20);

// 5. Assert: action selection changed (policy updated), beliefs unchanged
const actionsAfter = await nar.tools.execute('getActionStats', {});
expect(actionsAfter.distribution).not.toEqual(actionsBefore.distribution);
expect(nar.getBeliefs()).toEqual(originalBeliefs); // epistemic firewall held
```

**What this exposes:** RewardGate → goal revision → policy update → action selection. The `RLFPLearner` must actually change behaviour.

---

## M6: Multi-Agent Delegation

**Protocol exists (`nar/src/cooperation/delegation.ts`). No test of Agent A ↔ Agent B.**

```typescript
// tests/nar/todo32-m6.test.ts
const agentA = await createAgent({ port: 8765, name: 'A' });
const agentB = await createAgent({ port: 8766, name: 'B' });

await agentA.start();
await agentB.start();

// A delegates to B: "What is the capital of France?"
const result = await agentA.delegate({
  target: 'ws://localhost:8766',
  task: { type: 'question', term: '(capitalOfFrance --> ?what)?' },
  ruleId: 'lm-curiosity-question',
});

// B runs the same LM rule with its local model, returns Narsese + truth
expect(result.term).toBeDefined();
expect(result.truth).toBeDefined();

// Result admitted through PerceptionGate with PEER_AGENT source quality
const beliefs = agentA.getBeliefs();
expect(beliefs.some(b => b.term.toString().includes('capitalOfFrance'))).toBe(true);
```

**What this exposes:** WebSocket transport, `CognitiveTaskDelegation` serialization, `PEER_AGENT` source quality, shadow validation, callback endpoints.

---

## M7: Single Config + Docs

**Today: 15 env vars + presets + CLI flags + 5 config files. A new user cannot start in <30 min.**

```typescript
// senars.config.ts (NEW — single source of truth)
export default {
  nar: {
    maxConcepts: 10000,
    maxTasksPerConcept: 100,
    persistState: true,
    statePath: '.cache/nar-state',
  },
  systemOne: {
    enabled: true,
    manifold: { provider: 'local' },  // or 'http' for remote
    heads: { calibrationLock: '.cache/calibration-lock.json' },
  },
  lm: {
    provider: 'llamacpp',  // or 'openai', 'transformers'
    model: 'qwen2.5-7b',
  },
  tools: { enabled: ['fs', 'shell', 'web', 'metta'] },
  memory: { maxConcepts: 100000, consolidationInterval: 10 },
} as const;
```

**Deliverables:**
- `senars.config.ts` — typed, validated (Zod), single file
- `pnpm config:check` — validates config at startup
- `docs/getting-started.md` — 30-min hello world: install → config → `pnpm start` → ask a question
- `docs/architecture.md` — one diagram + one paragraph per subsystem

---

## M8: Derivation Explainability

**`nar.ask()` returns answer + confidence. "Auditable" requires *why*.**

```typescript
// nar/src/query/api.ts (extend Answer type)
interface Answer {
  answer: Term | undefined;
  confidence: number;
  evidence: Task[];           // already exists
  derivation?: DerivationTrace;  // NEW
}

interface DerivationTrace {
  steps: DerivationStep[];
  premises: Task[];
  rulesFired: string[];
  finalTruth: Truth;
}

const answer = await nar.ask('(whiskers --> mammal)?');
// answer.derivation.steps → [{ rule: 'nal.deduction', premises: [...], conclusion: ..., truth: ... }]
// answer.derivation.rulesFired → ['nal.deduction', 'nal.revision']
```

**Test:** Ask a question → verify `derivation.steps` length > 0 → verify each step re-computes to the same truth (use `verifyRecord` from `@senars/core/verify-derivation`).

---

## Ordering & Dependencies

```
M1 (pipeline) ──→ M2 (egress)     // M1 needs §4.3; M2 needs M1
   │
   ├─→ M3 (MeTTa)                  // independent, tool wiring
   │
   ├─→ M4 (crash/recovery)         // independent, persistence
   │
   ├─→ M5 (reward→policy)          // needs M1 (goal + reward flow)
   │
   ├─→ M6 (multi-agent)            // needs M1 (delegation uses same pipeline)
   │
   ├─→ M7 (config)                 // do early — unblocks manual testing of M1-M6
   │
   └─→ M8 (explainability)         // builds on derivation recorder (already exists)
```

**Suggested execution order:** M7 → M1 → M2 → M3/M4 (parallel) → M5 → M6 → M8.

---

## Subsumed Items (from TODO30/TODO31)

| item | subsumed by | note |
|------|-------------|------|
| §4.3 T-J | M1 | J must admit for PerceptionGate ingress |
| O5 (Q3 rerun) | — | thesis coverage, not integration; do after M1-M4 |
| O6 (distill) | — | arcade demo, not core; do after M1 |
| O8 (retention) | M4 | crash/recovery test will stress retention |
| §5.9 (maxTasks) | M4 | crash/recovery test will stress task pressure |
| O3 (growth limit) | M1 | verify it doesn't break M1 pipeline |

---

## Invariant Checklist (unchanged)

- [x] NAL parity
- [x] Determinism
- [x] Hermetic
- [x] Epistemic firewall
- [x] 13 TODO29.a gates green
- [x] Rule set stable mid-cycle
- [x] Bool atom cannot name Task
- [x] Absence is a value
- [ ] **End-to-end pipeline composes** (M1)
- [ ] **Crash/recovery is lossless** (M4)
- [ ] **Rewards change policy, not beliefs** (M5)

---

## Exit Criteria

**The system is "working and usable" when:**
1. M1 passes — a user can ask a natural language question and get a grounded answer
2. M4 passes — the system survives process death
3. M7 passes — a new user can configure and run it in 30 minutes
4. M8 passes — every answer carries its derivation trace

Everything else (M2, M3, M5, M6) is *capability depth* — valuable, but not required for "usable."