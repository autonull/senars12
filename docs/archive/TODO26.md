# TODO26.md — Essential Capability Plan

**Status: T1 DONE. Rest deferred indefinitely.**

---

## T1 — The demo ✅ COMPLETED 2026-09-27

```typescript
const agent = await createCognitiveAgent({ preset: 'chat' });
await agent.teach('(cat --> animal). %1.00;0.90%');
const a = await agent.ask('(cat --> animal)?');
await agent.checkpoint();

const agent2 = await createCognitiveAgent({ preset: 'chat', resume: true });
const a2 = await agent2.ask('(cat --> animal)?');
assertDeepEqual(stripProvenance(a), stripProvenance(a2));
```

**Shipped in:**
- `nar/src/agent/cognitive-agent.ts` — `createCognitiveAgent({ preset: 'chat' })`
- `tests/nar/todo26-cognitive-agent.test.ts` — passes (teach/ask/checkpoint/resume + boot POST)

**Boot POST**: Fixed syllogism `(cat --> animal). (animal --> organism).` → deduction verified via `verifyRecord` (dependency-free).

---

## Everything else: DEFERRED

| Item | Reason |
|------|--------|
| T2: Bot transports (MCP/HTTP `/ready` `/metrics`) | No consumer. Bot CLI works. |
| T3: Capability matrix from test tags | Test tag infra doesn't exist; no reader. |
| T4: Self-improvement falsification gate | No probe task stream, no benchmark, no baseline. Research spike. |
| `pnpm self-verify` battery | 7 checks, 0 implemented. Would need new CLI + replay harness + invariant monitor. |
| Tier B/C labels | No one consumes Tier A yet; labeling is theater. |

---

## Definition of done — v1.0 (ACTUAL)

1. ✅ T1 unit test passes (`pnpm vitest run tests/nar/todo26-cognitive-agent.test.ts`)
2. ✅ Boot POST runs on every agent start
3. ✅ Checkpoint/resume equivalence verified
4. ✅ No pre-existing suite regressed

**That's it. Tier A cognitive runtime works.**

---

*Supersedes all prior TODO plans. This is the only living plan.*