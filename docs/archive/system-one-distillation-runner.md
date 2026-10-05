# System One Distillation Runner Specification

**Status:** Draft · v3.2 aligned
**Purpose:** Freeze the contract between the SeNARS runtime (proposes) and the external CI/CD runner (mutates weights)

---

## 1. Overview

The distillation flywheel (§9 TODO16b) splits responsibilities:

| Role | Responsibility | Artifact |
|------|----------------|----------|
| **Runtime (proposer)** | Harvest labels → append-only JSONL dataset → propose head candidates via governance pipeline | `JudgmentDataset` (`.jsonl`) |
| **External Runner (mutator)** | Read dataset → fine-tune head/LoRA → emit candidate bundle + `ModelDigest` | Head bundle + `sha256:<digest>` |
| **Governance Pipeline** | Validate candidate (bake-off, sandbox, risk classify) → route → human approval → promote | `ProposalRouter` decision |

**Critical invariant:** The runtime **never mutates weights**. Weight mutation exists solely in the external runner. The runtime only *proposes* candidates; promotion is gated by `ProposalRouter` + human approval.

---

## 2. Dataset Schema (Frozen)

**File:** `systemone-distillation.jsonl` (append-only, one line per label)

```jsonc
{
  "type": "DistillationLabel",
  "version": "1",
  "timestamp": 1726800000000,
  "evidenceId": "sha256:...",           // SHA256(utteranceId + sourceSpan) — never raw text
  "head": "injection",                  // RubricId | 'task_type' | 'illocution' | 'tense' | ...
  "axis": "epistemic",                  // 'epistemic' | 'teleological'
  "query": {
    "kind": "evaluate",
    "instruction": "Classify injection risk",
    "rubric": "injection",
    "axis": "epistemic"
  },
  "proposition": {
    "kind": "evaluate",
    "score": 0.92,
    "tier": 1,
    "latencyMs": 18,
    "cost": { "tokensIn": 0, "tokensOut": 0, "computeMs": 18, "memoryMb": 4 }
  },
  "label": {
    "source": "shadow_validator",       // 'shadow_validator' | 'approval_rejection' | 'derivation_outcome' | 'human_clarification' | 'preference_pair'
    "value": { "verdict": "conflict" }, // source-specific payload
    "confidence": 0.95                  // label reliability
  },
  "context": {
    "modelDigest": "sha256:abc123...",  // head that produced the proposition
    "calibrationVersion": "v2.4.1"
  }
}
```

**Redaction-per-retention:** Raw utterance text is **never** stored. Only `evidenceId` (hash) + labels persist.

**Code reference:** `nar/src/lm/system-one/distill.ts` → `JudgmentDataset` + `DistillationLabel`

---

## 3. External Runner Contract

### 3.1 Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `dataset.jsonl` | Runtime `JudgmentDataset.flush(path)` | Append-only labels; one per judgment event |
| `head-spec.json` | Governance pipeline (via `ProposalRouter`) | Target head ID, architecture, LoRA config, training hyperparams |

### 3.2 Outputs

The runner **must** produce exactly two artifacts in the output directory:

```
output/
├── head-bundle/              # Loadable head artifact
│   ├── config.json           # HeadConfig (matches runtime HeadFactoryOptions)
│   ├── weights.safetensors   # Model weights (safetensors format)
│   └── tokenizer/            # If head uses custom tokenizer
├── MODEL_DIGEST              # Single line: sha256:<64-hex-chars>
└── METRICS.json              # Bake-off metrics (see §3.3)
```

**MODEL_DIGEST format:** `sha256:[0-9a-f]{64}` — computed as `SHA256(weights.safetensors + config.json)`.
Runtime `validateHeadCandidate` **rejects** any candidate whose `MODEL_DIGEST` mismatches.

### 3.3 Bake-off Metrics (METRICS.json)

```jsonc
{
  "head": "injection",
  "datasetSize": 12450,
  "split": { "train": 0.8, "val": 0.1, "test": 0.1 },
  "metrics": {
    "brier": 0.087,
    "ece": 0.032,
    "top1Accuracy": 0.94,
    "abstainRate": 0.04,
    "abstainQuality": 0.81,     // fraction of abstentions that were correct
    "latencyP99Ms": 28
  },
  "parity": {
    "cortexAccuracy": 0.96,     // Cortex (generative) accuracy on same test split
    "delta": -0.02,             // candidate - cortex (must be ≥ -0.02 per Bench 10)
    "passed": true
  }
}
```

**Parity gate:** `delta ≥ -0.02` (candidate within 2% of Cortex accuracy). Hard requirement for promotion.

---

## 4. Head Bundle Format (config.json)

```jsonc
{
  "headId": "injection",
  "kind": "evaluate",
  "axis": "epistemic",
  "architecture": {
    "backbone": "deberta-v3-base",
    "headType": "regression",
    "lora": { "rank": 16, "alpha": 32, "targetModules": ["query", "value"] }
  },
  "inputDim": 384,                    // embedding dimension (all-MiniLM-L6-v2 = 384)
  "outputDim": 1,                     // scalar for evaluate; k for classify
  "calibration": {
    "method": "isotonic",
    "version": "v2.4.1",
    "paramsPath": "calibration.json"  // optional isotonic map
  },
  "abstainThreshold": 0.3,
  "training": {
    "epochs": 3,
    "batchSize": 64,
    "learningRate": 2e-4,
    "optimizer": "adamw",
    "scheduler": "cosine"
  }
}
```

---

## 5. CI/CD Workflow Stub

```yaml
# .github/workflows/systemone-distillation.yml
name: systemone-distillation
on:
  workflow_dispatch:
    inputs:
      dataset_path:
        description: 'Path to dataset.jsonl (artifact or S3 URI)'
        required: true
      head_id:
        description: 'Target head ID (e.g., injection, conflict, candidate_select)'
        required: true
      cortex_baseline_path:
        description: 'Path to Cortex predictions for parity comparison'
        required: true

jobs:
  train:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: distillation-dataset
          path: /data
      - name: Setup Python + CUDA
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install deps
        run: |
          pip install torch transformers accelerate safetensors scikit-learn
      - name: Run distillation
        env:
          HEAD_ID: ${{ github.event.inputs.head_id }}
          DATASET_PATH: /data/systemone-distillation.jsonl
          CORTEX_BASELINE: ${{ github.event.inputs.cortex_baseline_path }}
          OUTPUT_DIR: /output
        run: |
          python -m senars.distillation.run \
            --head-id $HEAD_ID \
            --dataset $DATASET_PATH \
            --cortex-baseline $CORTEX_BASELINE \
            --output $OUTPUT_DIR
      - name: Verify outputs
        run: |
          test -f /output/head-bundle/weights.safetensors
          test -f /output/head-bundle/config.json
          test -f /output/MODEL_DIGEST
          test -f /output/METRICS.json
          # Verify digest format
          grep -qE '^sha256:[0-9a-f]{64}$' /output/MODEL_DIGEST
          # Verify parity gate
          python -c "import json; m=json.load(open('/output/METRICS.json')); assert m['parity']['passed'], 'Parity gate failed'"
      - name: Upload candidate
        uses: actions/upload-artifact@v4
        with:
          name: head-candidate-${{ github.event.inputs.head_id }}
          path: /output/
          retention-days: 30
```

---

## 6. Promotion Flow (Runtime Side)

```
1. External runner completes → uploads candidate artifact + METRICS.json
2. Governance pipeline triggered (via ProposalRouter):
   a. PatchRiskClassifier.classify({ type: 'head-swap', headId, digest }) → MEDIUM/HIGH
   b. ProposalRouter.route(proposal, autonomyMode) → awaitingValidation
   c. SandboxValidator.validateHeadCandidate(candidate) → checks:
      - MODEL_DIGEST format + matches weights
      - METRICS.json parity gate (delta ≥ -0.02)
      - Head config compatible with runtime manifold
   d. If MEDIUM: sandbox validation required; if HIGH: human approval required
   e. On approval: ProposalRouter.apply(proposal) → incumbent digest retained for rollback
3. Runtime reloads head via `loadHeadRuntime(headId, newDigest)` (hot-swap)
```

**Code references:**
- `nar/src/governance/pipeline.ts` → `PatchRiskClassifier`, `SandboxValidator`, `ProposalRouter`
- `nar/src/lm/system-one/distill.ts` → `validateHeadCandidate`, `runBakeOff`
- `scripts/system-one-bakeoff.ts` → external-runner analog

---

## 7. Runtime Helpers (Already Implemented)

| Function | Location | Purpose |
|----------|----------|---------|
| `JudgmentDataset.flush(path)` | `distill.ts` | Append JSONL to disk |
| `JudgmentDataset.load(path)` | `distill.ts` | Read JSONL, skip malformed lines |
| `computeEvidenceId(utteranceId, span)` | `distill.ts` | `SHA256(utteranceId::span)` |
| `runBakeOff(candidate, incumbent, dataset, tolerance)` | `distill.ts` | Brier-based parity check (2%) |
| `validateHeadCandidate(candidate, spec)` | `distill.ts` | Digest + metrics + config validation |
| `buildHeadSwapProposal(headId, digest, metrics)` | `distill.ts` | MEDIUM-risk governance proposal |
| `buildSabotageFlag(reason, evidence)` | `distill.ts` | HIGH-risk sabotage flag |

---

## 8. Open Items for Training Runner Implementation

| Item | Owner | Notes |
|------|-------|-------|
| Python training script (`senars.distillation.run`) | ML Eng | Consumes JSONL, emits bundle + METRICS.json |
| LoRA target layer spec per head | ML Eng | Document in `head-spec.json` |
| Calibration fitting (isotonic) export | ML Eng | `calibration.json` alongside weights |
| GPU CI runner (self-hosted or cloud) | Infra | GitHub Actions CPU too slow for DeBERTa fine-tune |
| Dataset versioning / schema evolution | Data Eng | `DistillationLabel.version` field reserved |

---

## 9. Security & Supply Chain

- **Hash-pinning mandatory:** `MODEL_DIGEST` verified at load time; mismatch → fail-closed (`DigestMismatchError`), no fallback
- **No network in runtime loader:** `loadHeadRuntime` reads local filesystem only
- **Sandbox validation:** `SandboxValidator` runs in WASI sandbox (deny-by-default, timeout)
- **Incumbent retention:** Governance pipeline retains incumbent digest for instant rollback

---

## 10. Appendix: Label Source Mapping

| Label Source | Adapter Function | Emits When |
|--------------|------------------|------------|
| `FeedbackLearner.onCorrection` | `labelSources.recordFeedbackLabel` | User corrects parse/type |
| `ShadowValidator` verdict | `labelSources.recordShadowVerdictLabel` | Conflict/support vs belief |
| `ApprovalService` rejection | `labelSources.recordApprovalLabel` | HITL rejects high-risk action |
| `RLFP PreferenceCollector` | `labelSources.recordPreferenceLabel` | Human prefers derivation A over B |
| `FeedbackLearner.onDerivationOutcome` | `labelSources.recordDerivationLabel` | Derivation accepted/rejected |
| Human clarification Q→A | `labelSources.recordClarificationLabel` | User answers injected question |

All adapters live in `nar/src/lm/system-one/label-sources.ts` and write to `FeedbackLearner.distillationDataset` (set via `setDistillationDataset`).