# TODO31: Close the thesis, choose the J, run the ablations

**Version:** 1.0 · **Status:** drafted 2026-10-02 · **Predecessor:** `TODO30.md` (v1.2 — §1–§3, §4.1, §5 first cuts + O1/O3 landed) · **Successor:** none yet.

**Scope:** the items TODO30 closed were *correctness* (the system answers what was asked, terms mean one thing). What remains is *calibration* and *measurement* — the thesis run, the J gate, the retention ablation, and the `maxTasks` sweep.

---

## Open Items

| # | item | status | blocker |
|---|------|--------|---------|
| 1 | **§4.3 T-J — a `J` that admits** | investigation mapped, decision required | product decision: fit real calibration lock **or** declare abstain-below-threshold path |
| 2 | **O5 — Q3 rerun preconditions** | thesis framing retired; coverage not thesis | §4.3 decision + symmetric arms (today only `nal` gets cognitive veto) |
| 3 | **O6 — distillation re-verification** | measured with broken `lm` arm (prefetch bug fixed since) | rerun `demo:arcade -- --distill` |
| 4 | **O8 — retention non-monotonic + confidence unstable** | cap 50 keeps answer, cap 100 drops it; conf 0.49–0.68 at cap 50 | idle-concept workload ablation first; then goal-directed retention decision |
| 5 | **§5.9 follow-up — `maxTasks` sweep** | 100→Infinity identical on §0.2 scale | >100-live-task workload (sustained multi-question under fixed concept cap) |

---

## 1. §4.3 T-J — A `J` That Admits

**Mechanism mapped (TODO30 §4.3):**
- `wireSystemOne` always builds a real `SystemOneIngressJudge` over the runtime manifold + embedding cache
- `KernelPerceptionGate.admitViaJudge` admits on any non-veto verdict; refuses only on veto/timeout/error
- Current "J refuses" behaviour comes from judge path faulting (no encoder/heads that admit), not a deliberate abstain rule
- Heads are unfitted stubs (hash scorers in `[0.3, 0.9]`) gated only by `abstainThreshold`

**Two ways to close (product decision, not a chore):**
| option | what it does | test change |
|--------|--------------|-------------|
| **(a) Fit real calibration** | Train heads on labelled `JudgmentDataset` rows, bind `calibration-lock.json` | a J-enabled config whose ingress admits, asserting same committed set as `S` |
| **(b) Declare abstain-below-threshold** | Deterministic/stub embeddings + explicit threshold in test config | extend `config:model-matrix` with a J-admits row |

**Do NOT** "fix" by silently lowering thresholds — the manifest (`DECISION_CALL_SITES`) is where the new binding must be declared.

---

## 2. O5 — Q3 Rerun Preconditions

The 2026-10-02 run falsified the macro thesis (nal 0.229 < manifold 0.257 < lm 0.345) but the framing is retired — coverage, not thesis.

**Preconditions for a meaningful rerun:**
1. **§4.3 decision landed** — fitted J or declared abstain path
2. **Symmetric arms** — `manifold` and `lm` must run in the same mode as `nal` (cognitive veto). Today only `nal` gets it.
3. **Larger model than 0.8B** — embedded Qwen3.5-0.8B is a floor, not a representative LM.
4. **RL baselines in matrix** — `qlearning`/`policygradient` now present (`scripts/lib/rl-arms.ts`, smoke-verified on bandit). A losing row is a repair ticket, not a verdict.

---

## 3. O6 — Distillation Re-verification

**Claim:** "distilled student matches teacher" (teacher→student distillation flywheel, `demo:arcade -- --distill`)

**Problem:** Measured while the `lm` arm never served an LM decision (prefetch bug, now fixed in `fix(arcade)` commit); the teacher was epsilon-greedy.

**Action:** Rerun `demo:arcade -- --distill` and verify the student learns anything beyond the incumbent.

---

## 4. O8 — Retention Non-monotonic + Confidence Unstable Under Pressure

**Measured (TODO30 §5.6 probe, §0.2 transcript under `maxConcepts` pressure):**

| maxConcepts | beliefs | answer | confidence |
|-------------|---------|--------|------------|
| 50 | 36 | kept | 0.49–0.68 (varies by run) |
| 100 | 76 | **dropped** | 0.000 |
| ≥200 | 133 | kept | 0.721 (stable) |

- Task credit never discriminates (40/40 concepts hold tasks)
- Age-first vs value-only victim ordering disagree on ~1/3 of top-10 victims (overlap 6–7/10)
- **Confidence is a noisy signal exactly when the store is under pressure** — any consumer that thresholds on confidence (J floors, relevance cutoffs) inherits this noise.

**Next ablation:** Workload with **idle concepts** (not all concepts holding tasks). Then decide:
- Goal-directed retention (protect question-touching concepts — storage twin of §1.2 option A)
- Or accept the noise and document the contract

---

## 5. §5.9 Follow-up — `maxTasks` Sweep

**Measured:** `maxTasks` 100 / 1k / 10k / 100k / `Infinity` at fixed `maxConcepts: 100000` → identical 133/137/0.721 everywhere. The §0.2 transcript's live task population never reaches even the lowest cap.

**`Infinity` stays** until a workload with >100 live tasks exists. Specified experiment: sustained multi-question input under a fixed concept cap.

---

## Invariant Checklist (carried from TODO30 §7)

- [x] NAL parity (`nal2-copula`, `nal7-temporal`, `nal8-procedural`, `nal9-self`)
- [x] Determinism (`test:determinism` passes)
- [x] Hermetic (`test:hermetic` passes)
- [x] Epistemic firewall (no model→Truth outside gates)
- [x] 13 TODO29.a gates green
- [x] Rule set stable mid-cycle
- [x] Bool atom cannot name Task
- [x] Absence is a value (U1 refusal, U4 no-op, unbounded = declared)

---

## Ordering

```
§4.3 (J admits)          ── decision required before code
   │
   ├─→ O5 (Q3 rerun)      ── after §4.3 + symmetric arms
   │
   ├─→ O6 (distill rerun) ── independent, after arcade fix
   │
   └─→ O8 (retention)     ── idle-concept ablation first
         │
         └─→ §5.9 (maxTasks) ── >100-live-task workload
```

**Rule:** optimization may change **how** committed state is indexed/retrieved; it may never change **what counts as** committed state (TODO30 §7.9, carried forward).