---
title: "Core 24 — Remaining Work After Core 23"
status: "planned"
---

### Remaining Work (26 failed test files / 56 failed tests in unit suite)

**Deferred**: All UI/server tests (event-catalog, field-catalog, layout-registry, lens-catalog) — UI package not built, may be redesigned.

---

## 1. LogStore/ThreadPool Persistence (5 failures)
- `focustree-cognitivethread.test.ts` — ThreadPool tests (5)

## 2. Budget Gate (3 failures) — Pre-existing baseline drift
- `refactor4-budget.test.ts` — Update `complexity-budget.json` baseline

## 3. MCP Bridge (5 failures)
- `mcp-bridge.test.ts` — zodFromSchema, registerNARRegistryTools, registerNARTools (4)
- `mcp-resources.test.ts` — reflects persisted boundary on restart (1)

## 4. Core19 Family (10+ failures)
- `core19-acceptance.test.ts` — acceptance walkthrough
- `core19-c1.test.ts` — one event stream (4)
- `core19-c3.test.ts` — gate observation & provenance (4)
- `core19-c4.test.ts` — restore replays gate log
- `core19-c5.test.ts` — autonomy configuration (7)
- `core19-c6.test.ts` — structured formalizer (2)
- `core19-m0.test.ts` — kernel control plane

## 5. todo29a Family (3 failures)
- `todo29a-a6.test.ts` — device profiles
- `todo29a-a11.test.ts` — model matrix
- `todo29a-model-matrix.test.ts` — model matrix

## 6. Kernel Terms (12 failures)
- `kernel/terms.test.ts` — Narsese parser, standardizeApart, canonicalEquals bugs

## 7. Security (1 failure)
- `todo20-security.test.ts` — tool input validation, LM response sanitization

## 8. NARLM (1 failure)
- `inference-nario-lm.test.ts` — NARLM tests

## 9. RL Parity (1 failure)
- `cognitive-advantage.test.ts` — Adaptation After Environmental Change

## 10. Derivation Verifier (2 failures)
- `derivation-verifier.test.ts` — verifies revision/negation algebra, flags unknown independence

## 11. Game Registry (3 failures)
- `game-registry.test.ts` — registers games, arcade collection, seed parity

## 12. Integration (2 failures)
- `integration/multi-agent.test.ts` — Multi-Engine Agent Integration (2)

## 13. todo16 Family (likely more)
- `todo16-device-profile.test.ts` — provider fallback
- `todo16c-f5-dispositions.test.ts` — manifold health, novelty gate
- `todo16c-cortex.test.ts` — cortex health check
- `todo16-provisional.test.ts` — provisional priority decay (may be fixed)

## 14. todo20 Kernel Layering (1 failure)
- `todo20-kernel-layering.test.ts`

## 15. todo27 North Star (1 failure)
- `todo27-north-star.test.ts`

---

## Success Criteria
- Unit suite pass rate > 95% (currently 97.3%)
- All LogStore/ThreadPool persistence tests passing
- MCP bridge functional
- Core19 acceptance walkthrough working
- Kernel terms parser fixed

---

## File Index
- **Config**: `vitest.config.ts` (542 aliases)
- **Framework**: `tests/nar/framework/ReasoningTestBuilder.ts`
- **Key Source**:
  - `src/log/store.ts` — LogStore persistence
  - `src/kernel/KernelActionGate.ts` — BoundedMap, autonomy transitions
  - `src/kernel/KernelPerceptionGate.ts` — mintCognitiveEvent
  - `src/schemas/truth.ts` — clamp01, confidenceCeiling
  - `src/lm/system-one/verify.ts` — verifyCascade
  - `src/proposal/lifecycle.ts` — ProposalLifecycle
  - `src/mcp/bridge.ts` — MCP bridge
  - `src/terms/impls/parser.ts` — Narsese parser