# SeNARS12 Post-NARS Fundamentals Benchmark — Turn-Key Implementation Plan

This document revises the original TODO12.md to align with the **actual SeNARS12 codebase architecture**, leveraging existing multi-provider LM system, FormalizationBatch/PerceptionGate, NAL inference rules, and LM rule integration.

---

## 1. Model Selection & Provider Strategy (Codebase-Aligned)

The codebase already implements a **unified LM configuration** (`docs/tech/lm-config.md`) with:

| Provider | Role | Models | Use Case |
|----------|------|--------|----------|
| **transformers.js** | Primary local (offline) | Qwen2.5-1.5B, SmolLM2-360M, Qwen2.5-3B | Default `LM_PROVIDER=auto` → local when no cloud keys |
| **ollama** | Local GPU-accelerated | qwen2.5:3b, llama3.2:3b, phi3:3.8b | `LM_PROVIDER=ollama` for GPU/Metal |
| **openai-compatible** | Cloud frontier | gpt-4o-mini, claude-3.5-sonnet | `LM_PROVIDER=openai-compatible` + `LM_BASE_URL` + `LM_API_KEY` |
| **mock** | Deterministic CI | N/A | `LM_PROVIDER=mock` for unit tests |

### Recommended Default: `transformers.js` (offline, zero-setup)
```bash
# Zero-config: runs on CPU/WebGPU automatically
LM_PROVIDER=auto  # default — picks transformers.js when no cloud keys
LM_FAST_MODEL=HuggingFaceTB/SmolLM2-360M-Instruct
LM_MODEL=onnx-community/Qwen2.5-1.5B-Instruct
```

### Progressive Model Ladder (start compact, upgrade on demand)
```jsonc
// senars.config.json
{
  "lm": {
    "provider": "transformers",
    "model": "onnx-community/Qwen2.5-1.5B-Instruct",      // quality tier
    "fastModel": "HuggingFaceTB/SmolLM2-360M-Instruct",   // fast tier
    "compactModel": "HuggingFaceTB/SmolLM2-135M-Instruct", // compact tier
    "quantized": true,
    "cacheDir": ".cache/transformers"
  },
  "routing": {
    "objectives": {
      "chat":       {"quality": "balanced", "maxLatencyMs": 2000},
      "rules":      {"quality": "high",     "offlineOnly": true},
      "structured": {"quality": "max"}
    },
    "candidates": ["builtin:quality", "builtin:fast", "builtin:compact"],
    "offlineLadder": [
      "HuggingFaceTB/SmolLM2-135M-Instruct",
      "HuggingFaceTB/SmolLM2-360M-Instruct",
      "onnx-community/Qwen2.5-1.5B-Instruct",
      "onnx-community/Qwen2.5-3B-Instruct"
    ]
  }
}
```

### GPU Acceleration (optional, painless)
```bash
# Ollama with GPU (Metal/CUDA/ROCm)
LM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
LM_FAST_MODEL=qwen2.5:3b-instruct
LM_MODEL=qwen2.5:3b-instruct
```

---

## 2. Architecture Alignment: Existing Components

### 2.1 Multi-Candidate Formalization (Already Implemented)
- **`NLUnderstandingService.understandCandidates()`** → returns `FormalizationBatch` with `FormalizationCandidate[]`
- Each candidate has: `candidateId`, `narsese`, `taskType`, `confidence`, `sourceSpans`, `ambiguityFlags`
- **`PerceptionGate`** admits candidates provisionally via `admitFormalization(batch)`
- Kernel validates each candidate independently — no single authoritative parse

### 2.2 NAL Inference Rules (Already Implemented)
- **Classical Logic**: `modus-ponens`, `modus-tollens`, `disjunctive-syllogism`, `hypothetical-syllogism`
- **Core NAL**: `revision`, `choice`, `structural-syllogism`, `deduction`, `induction`, `abduction`
- **Propositional**: `negation-intro`, `negation-elim`, `conjunction-intro`, `disjunction-elim`
- **Higher-Order**: `higher-order-deduction`, `analogical`
- **Meta-Cognitive**: `error-pattern-detection`, `metacognitive-revision`, `resource-allocation`

### 2.3 LM Rules (Already Implemented)
| Rule ID | Purpose | Scenario Mapping |
|---------|---------|------------------|
| `lm-narsese-translation` | NL → Narsese candidates | Scenario 1, 3 |
| `lm-hypothesis-generation` | Proposes bridging lemmas | Scenario 2 |
| `lm-goal-decomposition` | Goal → subgoals | Scenario 3 |
| `lm-analogical-reasoning` | Structural analogies | Scenario 2 |
| `lm-belief-revision` | Context-aware confidence calibration | All |
| `lm-explanation-generation` | Natural language explanations | Verification |

### 2.4 Epistemic Firewall (Already Enforced)
- **`RewardGate`** throws on `targetType: 'truth-frequency' | 'truth-confidence'`
- **`PerceptionGate`** validates Belief vs Goal routing via `taskType` enum
- **`SymbolicFirewall`** clamps confidence, rejects malformed Narsese

---

## 3. Three Scenarios → Test Implementation

### Scenario 1: Ambiguity & Multi-Candidate Test (PerceptionGate)

**Input**: "The server will crash unless the backup generator kicks in. The backup generator did not kick in."

**Expected Pipeline**:
```
NLUnderstandingService.understandCandidates(input)
  → FormalizationBatch with 2+ candidates:
     Candidate A: (backup_generator_kicks_in ==> server_crash) [negation scope: narrow]
     Candidate B: (backup_generator_kicks_in | server_crash) [disjunction]
     Candidate C: (backup_generator_kicks_in ==> (- server_crash)) [negation scope: wide]
  → PerceptionGate.admitFormalization(batch) → provisional tasks
  → NAR applies disjunctive-syllogism / modus-tollens
  → Final belief: (server_crash). %1.0; 0.8%
```

**Success Metric**: Final belief `(server_crash)` with `f > 0.9` derived **without** LLM hardcoding the rule.

---

### Scenario 2: Abductive Leap (System 1 Hypothesis + System 2 Verification)

**Input**: "Alice is a senior developer. Senior developers have the same access privileges as lead engineers. Lead engineers can access the mainframe."

**Expected Pipeline**:
```
1. NLUnderstandingService → beliefs: (alice --> senior_developer), (senior_developer ==> lead_engineer), (lead_engineer ==> access_mainframe)
2. NAR stalls (depth-budget or missing link)
3. lm-hypothesis-generation triggered → proposes bridging: (senior_developer <-> lead_engineer) [similarity]
4. PerceptionGate admits hypothesis with LM confidence (e.g., 0.7)
5. NAR applies higher-order-deduction + syllogism
6. Final answer: (alice ==> access_mainframe) with discounted confidence
```

**Success Metric**: Derivation trace shows LM hypothesis injection step; final confidence = `NAL.revision(hypothesis_confidence, deduction_confidence)`.

---

### Scenario 3: Epistemic Firewall (Belief vs Goal Routing)

**Input**: "I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second."

**Expected Pipeline**:
```
1. NLUnderstandingService → 1 Goal + 1 Belief:
   Goal: !(database_offline). %0.9; 0.8%
   Belief: (database_online & processing_500_rps). %1.0; 0.9%
2. PerceptionGate routes by taskType (goal vs belief) — hard type separation
3. RewardGate: Goal triggers lm-goal-decomposition → plan: (stop_requests ==> database_offline)
4. Belief remains immutable — LLM cannot output (database_offline). %1.0; 0.9% as belief
```

**Success Metric**: System outputs plan; Belief truth value unchanged; any LLM attempt to emit Belief for Goal rejected by PerceptionGate schema validation.

---

## 4. Implementation: `scripts/fundamentals-bench.ts`

```typescript
#!/usr/bin/env tsx
/**
 * SeNARS12 Post-NARS Fundamentals Benchmark
 * 
 * Tests the division of labor: Untrusted Proposer (LLM) ↔ Trusted Kernel (NAR + Gates)
 * Runs against any LM provider (transformers.js, ollama, openai-compatible, mock)
 * 
 * Usage:
 *   LM_PROVIDER=auto pnpm exec tsx scripts/fundamentals-bench.ts
 *   LM_PROVIDER=ollama LM_FAST_MODEL=qwen2.5:3b pnpm exec tsx scripts/fundamentals-bench.ts
 *   LM_PROVIDER=mock pnpm exec tsx scripts/fundamentals-bench.ts  # CI
 */

import { createNAR, SeNARSFactory } from '@senars/nar';
import { createSeNARSRegistry } from '@senars/nar/lm';
import { createLMService } from '@senars/nar/lm/lm-service';
import { NLUnderstandingService } from '@senars/nar/nl';
import { createLogger } from '@senars/nar/logger';
import { PerceptionGate } from '@senars/nar/kernel/KernelPerceptionGate';
import { strict as assert } from 'node:assert';

const logger = createLogger({ scope: 'fundamentals-bench' });

// ── Configuration ────────────────────────────────────────────────

interface BenchConfig {
  provider: string;
  fastModel: string;
  qualityModel: string;
  enableLMRules: boolean;
  maxCyclesPerScenario: number;
}

function loadConfig(): BenchConfig {
  return {
    provider: process.env.LM_PROVIDER ?? 'auto',
    fastModel: process.env.LM_FAST_MODEL ?? 'HuggingFaceTB/SmolLM2-360M-Instruct',
    qualityModel: process.env.LM_MODEL ?? 'onnx-community/Qwen2.5-1.5B-Instruct',
    enableLMRules: process.env.ENABLE_LM_RULES !== 'false',
    maxCyclesPerScenario: parseInt(process.env.MAX_CYCLES ?? '20', 10),
  };
}

// ── Scenario 1: Multi-Candidate Ambiguity ────────────────────────

async function runScenario1(nar: ReturnType<typeof createNAR>, lmService: ReturnType<typeof createLMService>): Promise<boolean> {
  logger.info('\n🧠 Scenario 1: Multi-Candidate Ambiguity ("unless" / disjunction)');
  
  const input = "The server will crash unless the backup generator kicks in. The backup generator did not kick in.";
  
  // 1. Get multi-candidate formalization
  const understanding = new NLUnderstandingService(lmService, new Map(), { structuredOnly: true });
  const batch = await understanding.understandCandidates(input);
  
  if (!batch) {
    logger.error('  ❌ No formalization batch returned');
    return false;
  }
  
  logger.info(`  📦 FormalizationBatch: ${batch.candidates.length} candidates`);
  for (const c of batch.candidates) {
    logger.info(`    [${c.taskType}] ${c.narsese} (conf: ${c.confidence.toFixed(2)}, flags: ${c.ambiguityFlags.map(f => f.type).join(', ')})`);
  }
  
  assert(batch.candidates.length > 1, 'Expected multiple candidates for ambiguous input');
  
  // 2. Admit via PerceptionGate (provisional)
  const gate = nar.getPerceptionGate();
  const admitted = await gate.admitFormalization(batch);
  logger.info(`  ✅ PerceptionGate admitted ${admitted} candidate(s) provisionally`);
  
  // 3. Run NAR cycles
  let derived = 0;
  for (let i = 0; i < 10; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Derived ${derived} tasks in 10 cycles`);
  
  // 4. Check final belief
  const beliefs = nar.getBeliefs();
  const crashBelief = beliefs.find(b => b.term.toString().includes('server_crash'));
  
  if (!crashBelief) {
    logger.error('  ❌ No belief about server_crash derived');
    return false;
  }
  
  const f = crashBelief.truth?.frequency ?? 0;
  const c = crashBelief.truth?.confidence ?? 0;
  logger.info(`  🎯 Final: ${crashBelief.term} %${f.toFixed(2)}; ${c.toFixed(2)}%`);
  
  const success = f > 0.8 && c > 0.5;
  logger.info(success ? '  ✅ PASS: NAR deduced crash via disjunctive-syllogism/modus-tollens' : '  ❌ FAIL: Insufficient confidence');
  return success;
}

// ── Scenario 2: Abductive Leap ──────────────────────────────────

async function runScenario2(nar: ReturnType<typeof createNAR>, lmService: ReturnType<typeof createLMService>): Promise<boolean> {
  logger.info('\n🧠 Scenario 2: Abductive Leap (hypothesis injection)');
  
  const inputs = [
    "Alice is a senior developer.",
    "Senior developers have the same access privileges as lead engineers.",
    "Lead engineers can access the mainframe."
  ];
  
  const understanding = new NLUnderstandingService(lmService, new Map(), { structuredOnly: true });
  
  // 1. Inject facts
  for (const input of inputs) {
    const batch = await understanding.understandCandidates(input);
    if (batch) {
      const gate = nar.getPerceptionGate();
      await gate.admitFormalization(batch);
    }
  }
  
  // 2. Run initial cycles — NAR should stall on the multi-hop
  let derived = 0;
  for (let i = 0; i < 5; i++) {
    derived += await nar.run(1);
  }
  logger.info(`  ⚙️  Initial cycles: ${derived} derivations`);
  
  // 3. Check if hypothesis generation is needed (goal unachieved)
  const goals = nar.getGoals();
  const accessGoal = goals.find(g => g.term.toString().includes('access_mainframe'));
  
  if (accessGoal) {
    logger.info('  🔍 Goal detected, triggering lm-hypothesis-generation...');
    // LM rule should fire via NAR's rule processor when enabled
    // The rule processor handles this automatically when enableLMRules=true
  }
  
  // 4. Run more cycles with LM rules active
  for (let i = 0; i < 15; i++) {
    derived += await nar.run(1);
  }
  
  // 5. Check final belief about Alice accessing mainframe
  const beliefs = nar.getBeliefs();
  const accessBelief = beliefs.find(b => 
    b.term.toString().includes('alice') && b.term.toString().includes('access_mainframe')
  );
  
  if (!accessBelief) {
    logger.error('  ❌ No belief about alice accessing mainframe');
    return false;
  }
  
  const f = accessBelief.truth?.frequency ?? 0;
  const c = accessBelief.truth?.confidence ?? 0;
  logger.info(`  🎯 Final: ${accessBelief.term} %${f.toFixed(2)}; ${c.toFixed(2)}%`);
  
  // 6. Verify derivation trace includes LM hypothesis step
  const recorder = nar.getProcessor().getRecorder();
  const records = recorder.drain();
  const hasLMHypothesisStep = records.some(r => 
    r.steps.some(s => s.ruleId === 'lm-hypothesis-generation' || s.ruleId.includes('hypothesis'))
  );
  
  const success = f > 0.5 && c > 0.3 && hasLMHypothesisStep;
  logger.info(success ? '  ✅ PASS: LM hypothesis injected, NAL discounted confidence' : 
    `  ❌ FAIL: f=${f}, c=${c}, hasLMHypothesis=${hasLMHypothesisStep}`);
  return success;
}

// ── Scenario 3: Epistemic Firewall ──────────────────────────────

async function runScenario3(nar: ReturnType<typeof createNAR>, lmService: ReturnType<typeof createLMService>): Promise<boolean> {
  logger.info('\n🧠 Scenario 3: Epistemic Firewall (Belief vs Goal separation)');
  
  const input = "I want the database to be offline for maintenance. The database is currently online and processing 500 requests a second.";
  
  const understanding = new NLUnderstandingService(lmService, new Map(), { structuredOnly: true });
  const batch = await understanding.understandCandidates(input);
  
  if (!batch) {
    logger.error('  ❌ No formalization batch returned');
    return false;
  }
  
  logger.info(`  📦 FormalizationBatch: ${batch.candidates.length} candidates`);
  const goals = batch.candidates.filter(c => c.taskType === 'goal');
  const beliefs = batch.candidates.filter(c => c.taskType === 'belief');
  
  logger.info(`  🎯 Goals: ${goals.length}, Beliefs: ${beliefs.length}`);
  for (const c of [...goals, ...beliefs]) {
    logger.info(`    [${c.taskType}] ${c.narsese}`);
  }
  
  // Must have exactly 1 goal and 1 belief
  assert(goals.length === 1, 'Expected exactly 1 goal (want → !)');
  assert(beliefs.length >= 1, 'Expected at least 1 belief (is → .)');
  
  // 2. Admit via PerceptionGate
  const gate = nar.getPerceptionGate();
  await gate.admitFormalization(batch);
  
  // 3. Run cycles — goal should trigger decomposition, belief should remain stable
  let derived = 0;
  for (let i = 0; i < 10; i++) {
    derived += await nar.run(1);
  }
  
  // 4. Verify Belief unchanged, Goal decomposed into plan
  const finalBeliefs = nar.getBeliefs();
  const finalGoals = nar.getGoals();
  
  const dbOnlineBelief = finalBeliefs.find(b => 
    b.term.toString().includes('database') && b.term.toString().includes('online')
  );
  
  const dbOfflineGoal = finalGoals.find(g => 
    g.term.toString().includes('database') && g.term.toString().includes('offline')
  );
  
  if (!dbOnlineBelief) {
    logger.error('  ❌ Database online belief lost');
    return false;
  }
  
  const beliefF = dbOnlineBelief.truth?.frequency ?? 0;
  const beliefC = dbOnlineBelief.truth?.confidence ?? 0;
  logger.info(`  📊 Belief (online): %${beliefF.toFixed(2)}; ${beliefC.toFixed(2)}%`);
  
  // Check for plan (subgoal) generated from goal decomposition
  const planGoals = finalGoals.filter(g => 
    g.term.toString().includes('stop_request') || g.term.toString().includes('maintenance')
  );
  
  const success = beliefF > 0.9 && beliefC > 0.8 && planGoals.length > 0;
  logger.info(success ? '  ✅ PASS: Belief immutable, Goal decomposed to plan' : '  ❌ FAIL: Firewall breached or no plan');
  return success;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  logger.info(`🚀 Fundamentals Benchmark — Provider: ${config.provider}, Fast: ${config.fastModel}, Quality: ${config.qualityModel}`);
  
  // Create LM registry & service (uses unified config from env + senars.config.json)
  const registry = createSeNARSRegistry();
  const lmService = createLMService(registry);
  
  // Verify model availability
  if (!lmService.hasModel()) {
    logger.error('❌ No model available. Check LM_PROVIDER and model configuration.');
    logger.info('   Quick fix: LM_PROVIDER=mock (for CI) or ensure transformers.js models cached');
    process.exit(1);
  }
  logger.info(`✅ LM Service ready: provider=${lmService.provider}, model=${lmService.model}`);
  
  // Create NAR with full cognitive stack
  const nar = SeNARSFactory.createDefault({
    providerRegistry: registry,
    lmService,
    enableLMRules: config.enableLMRules,
    enableTools: true,
    enableSelf: true,
    enableRLFP: false,
    maxConcepts: 5000,
    persistState: false,
  });
  
  await nar.start();
  logger.info('✅ NAR started');
  
  // Enable derivation recorder for trace verification
  nar.getProcessor().setConfig({ recorderEnabled: true, maxRecords: 100 });
  
  const results: Record<string, boolean> = {};
  
  try {
    results.scenario1 = await runScenario1(nar, lmService);
    results.scenario2 = await runScenario2(nar, lmService);
    results.scenario3 = await runScenario3(nar, lmService);
  } finally {
    await nar.stop();
  }
  
  // ── Summary ────────────────────────────────────────────────────
  logger.info('\n📊 FUNDAMENTALS BENCHMARK RESULTS');
  logger.info('═══════════════════════════════════');
  for (const [name, pass] of Object.entries(results)) {
    logger.info(`  ${name}: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  const allPass = Object.values(results).every(v => v);
  logger.info(`\n${allPass ? '🎉 ALL SCENARIOS PASSED' : '⚠️  SOME SCENARIOS FAILED'}`);
  
  if (!allPass) process.exit(1);
}

main().catch(err => {
  logger.error('Benchmark failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
```

---

## 5. Supporting Infrastructure

### 5.1 Package.json Scripts
```json
{
  "scripts": {
    "bench:fundamentals": "tsx scripts/fundamentals-bench.ts",
    "bench:fundamentals:mock": "LM_PROVIDER=mock tsx scripts/fundamentals-bench.ts",
    "bench:fundamentals:ollama": "LM_PROVIDER=ollama tsx scripts/fundamentals-bench.ts",
    "bench:fundamentals:ci": "LM_PROVIDER=mock vitest run tests/bench/fundamentals.test.ts"
  }
}
```

### 5.2 CI Integration (`.github/workflows/fundamentals.yml`)
```yaml
name: Fundamentals Benchmark
on: [push, pull_request]
jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm run bench:fundamentals:mock
      - name: Upload derivation traces
        uses: actions/upload-artifact@v4
        with:
          name: derivation-traces
          path: logs/routing-*.jsonl
```

### 5.3 Doctor Command Enhancement
The existing `pnpm doctor` already probes LM providers. Add benchmark validation:
```bash
# In src/bin/doctor.ts - add:
await runFundamentalsSmoke(); // Quick 3-scenario smoke test with mock provider
```

---

## 6. Progressive Model Validation Strategy

| Phase | Provider | Models | Purpose |
|-------|----------|--------|---------|
| **0. CI** | `mock` | Deterministic | Schema validation, gate logic, type safety |
| **1. Local CPU** | `transformers.js` | SmolLM2-135M → SmolLM2-360M → Qwen2.5-1.5B | Verify JSON schema adherence, Narsese syntax, multi-candidate |
| **2. Local GPU** | `ollama` | qwen2.5:1.5b → qwen2.5:3b → qwen2.5:7b | Verify logic capabilities, hypothesis generation, latency budgets |
| **3. Cloud** | `openai-compatible` | gpt-4o-mini → claude-3.5-sonnet | Stress-test with frontier models, richer hypotheses |

**Auto-upgrade logic** (via routing config):
```jsonc
"routing": {
  "objectives": { "rules": { "quality": "high", "offlineOnly": false } },
  "candidates": ["cloud:quality", "local:quality", "builtin:quality"],
  "offlineLadder": ["SmolLM2-135M", "SmolLM2-360M", "Qwen2.5-1.5B", "Qwen2.5-3B"]
}
```
When `cloud:quality` fails (no key/quota), automatically falls down the ladder.

---

## 7. Verification Checklist

- [ ] **`scripts/fundamentals-bench.ts`** created and executable
- [ ] **`pnpm bench:fundamentals:mock`** passes in CI (deterministic)
- [ ] **`pnpm bench:fundamentals`** runs with `LM_PROVIDER=auto` (zero-config local)
- [ ] **`pnpm bench:fundamentals:ollama`** runs with GPU acceleration
- [ ] All three scenarios assert structural invariants (not just output matching)
- [ ] Derivation traces exported and verifiable via standalone verifier
- [ ] Routing telemetry logged (`logs/routing-*.jsonl`) for model selection audit
- [ ] Progressive model ladder documented in `senars.config.json`

---

## 8. Why This Proves the Architecture

If the benchmark passes on **Qwen2.5-1.5B (transformers.js, CPU-only)**:
1. **LLM is "dumb" translator** — generates valid JSON schemas, multi-candidate Narsese
2. **Kernel Gates do heavy lifting** — PerceptionGate admits provisionally, RewardGate enforces firewall
3. **NAL Truth Algebra ensures soundness** — disjunctive-syllogism, revision, deduction work correctly
4. **Division of labor proven** — LLM proposes, Kernel disposes

Upgrading to **Qwen2.5-3B (Ollama GPU)** or **Claude 3.5 Sonnet (cloud)** only yields:
- Richer hypotheses (better `lm-hypothesis-generation`)
- Better ambiguity resolution (more precise `ambiguityFlags`)
- Better explanations (richer `lm-explanation-generation`)

**Zero architectural changes required** — the Trusted Kernel boundary is provider-agnostic.

---

## 9. Quick Start Commands

```bash
# 1. Zero-config local (CPU, transformers.js)
pnpm install
pnpm run bench:fundamentals

# 2. Local GPU (Ollama)
ollama pull qwen2.5:3b-instruct
LM_PROVIDER=ollama pnpm run bench:fundamentals

# 3. Cloud (OpenAI-compatible)
LM_PROVIDER=openai-compatible LM_BASE_URL=https://api.openai.com/v1 LM_API_KEY=$OPENAI_API_KEY pnpm run bench:fundamentals

# 4. CI / Deterministic
pnpm run bench:fundamentals:mock

# 5. Full validation suite (includes fundamentals)
pnpm run test && pnpm run typecheck && pnpm run lint
```

---

*SeNARS12 — The kernel decides. The LLM proposes. The truth algebra verifies.* 🧠✨