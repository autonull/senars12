# RFC: External Self-Modification Governance Pipeline

**Status:** Draft  
**Author:** SeNARS12 Architecture Team  
**Date:** 2026-09-10  
**Related:** TODO7.md Track B (Safety, Sandboxing & Governance)

---

## 1. Problem Statement

The current self-improvement loop (shadow worktree + CI + ApprovalManager) runs **inside the agent's modifiable codebase**. This creates a critical vulnerability: an agent that can modify its own approval logic, sandbox config, or reward functions can trivially escalate to arbitrary code execution.

**Threat Model:**
- Agent proposes patch disabling `ApprovalManager` → self-approves → escapes sandbox
- Agent modifies `RewardGate` to allow truth mutation → reward hacks beliefs
- Agent alters WASI sandbox config → gains network/filesystem access
- Agent rewrites its own autonomy mode → jumps to `human-approved-production` without review

**Requirement:** Self-modification approval logic MUST reside **outside the agent's modifiable codebase** in an immutable, external CI/CD runner.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT RUNTIME (Mutable)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NAR REASONER + SELF-IMPROVEMENT LOOP                               │   │
│  │  • Generates self-modification proposals (patches)                  │   │
│  │  • Executes in shadow worktree: git worktree add .shadow/fix-N      │   │
│  │  • Runs FULL CI (test + typecheck + lint) in shadow                 │   │
│  │  • On CI pass: emits PatchProposalEvent to event log                │   │
│  │  • CANNOT: merge, modify approval logic, modify sandbox config      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    PatchProposalEvent (immutable, signed)                   │
│                                    ▼                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                    EXTERNAL GOVERNANCE RUNNER (Immutable)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GOVERNANCE PIPELINE (runs in isolated CI/CD environment)           │   │
│  │  1. FETCH: Pull patch from agent's shadow worktree ref              │   │
│  │  2. VALIDATE: Verify CI passed, signature, provenance              │   │
│  │  3. CLASSIFY: PatchRiskClassifier → { risk: LOW | MEDIUM | HIGH }  │   │
│  │  4. POLICY: AutonomyMode + Risk → { AUTO_MERGE | HUMAN_REVIEW }    │   │
│  │  5. APPLY: Merge to main (if authorized) OR create PR for review   │   │
│  │  6. AUDIT: Emit GovernanceEvent to external audit log               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 AutonomyMode Enum (Immutable Contract)

```typescript
// THIS ENUM IS IMMUTABLE — agent cannot modify
export enum AutonomyMode {
  OBSERVE_ONLY = 'observe-only',           // No tool execution, read-only
  PROPOSE_ONLY = 'propose-only',           // Can propose patches, cannot execute
  SANDBOX_EXECUTE = 'sandbox-execute',     // Can execute tools in WASI sandbox
  LOW_RISK_AUTO_MERGE = 'low-risk-auto-merge', // Auto-merge LOW risk patches
  HUMAN_APPROVED_PRODUCTION = 'human-approved-production', // All merges require human
}
```

**Agent CANNOT modify:**
- `AutonomyMode` enum definition
- `ApprovalManager` logic
- `PatchRiskClassifier` logic
- WASI sandbox configuration
- Reward function definitions
- Governance pipeline code

### 3.2 Patch Proposal Schema

```typescript
// Emitted by agent as CognitiveEvent (type: 'self-mod.proposal')
export const PatchProposalSchema = z.object({
  proposalId: z.string().uuid(),
  patchRef: z.string(),              // git ref: refs/shadow/fix-<uuid>
  baseCommit: z.string(),            // SHA of main branch at proposal time
  patchDiff: z.string(),             // Unified diff
  ciResults: z.object({
    test: z.boolean(),
    typecheck: z.boolean(),
    lint: z.boolean(),
    durationMs: z.number().int().positive(),
  }),
  riskSelfAssessment: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  affectedComponents: z.array(z.enum([
    'approval-logic',
    'sandbox-config',
    'reward-functions',
    'autonomy-mode',
    'kernel-gates',
    'cognitive-params',
    'tools',
    'rules',
    'memory',
    'other',
  ])),
  rationale: z.string(),
  timestamp: z.number().int().positive(),
  agentSignature: z.string(),        // Ed25519 signature over patchDiff
});
```

### 3.3 Patch Risk Classifier (External, Immutable)

```typescript
// RUNS IN GOVERNANCE RUNNER — agent cannot modify
export class PatchRiskClassifier {
  classify(patch: PatchProposal): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    let score = 0;

    // CRITICAL: Any patch touching these = HIGH risk
    const criticalPaths = [
      'src/core/ApprovalManager.ts',
      'src/core/PolicyEngine.ts',
      'src/nar/gates/RewardGate.ts',
      'src/nar/gates/ActionGate.ts',
      'src/nar/gates/PerceptionGate.ts',
      'src/nar/gates/BudgetGate.ts',
      'src/nar/capability/*.ts',        // WASI sandbox config
      'src/nar/config/budget.ts',       // Budget limits
      'src/nar/rlfp/RewardModel.ts',    // Reward functions
      'src/nar/rlfp/PolicyOptimizer.ts',
      'src/util/types/cognitive.ts',    // AutonomyMode enum
      'kernel/src/schemas.ts',          // Kernel schemas (@senars/kernel)
    ];

    for (const file of patch.affectedFiles) {
      if (criticalPaths.some(p => minimatch(file, p))) {
        riskFactors.push({ factor: 'critical-path', file, severity: 'HIGH' });
        score += 50;
      }
    }

    // Heuristics
    if (patch.linesAdded + patch.linesRemoved > 500) score += 10;
    if (patch.affectedComponents.includes('approval-logic')) score += 40;
    if (patch.affectedComponents.includes('sandbox-config')) score += 40;
    if (patch.affectedComponents.includes('reward-functions')) score += 30;
    if (patch.affectedComponents.includes('autonomy-mode')) score += 40;
    if (patch.affectedComponents.includes('kernel-gates')) score += 30;

    // Test coverage delta
    if (patch.coverageDelta < -5) score += 15;

    const risk: RiskLevel = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';

    return { risk, score, factors: riskFactors, recommendation: this.getRecommendation(risk) };
  }

  private getRecommendation(risk: RiskLevel): GovernanceAction {
    switch (risk) {
      case 'LOW': return { action: 'AUTO_MERGE', requiresHuman: false };
      case 'MEDIUM': return { action: 'CREATE_PR', requiresHuman: true, reviewers: 1 };
      case 'HIGH': return { action: 'CREATE_PR', requiresHuman: true, reviewers: 2, securityTeam: true };
    }
  }
}
```

### 3.4 Governance Policy Engine (External, Immutable)

```typescript
// RUNS IN GOVERNANCE RUNNER — agent cannot modify
export class GovernancePolicyEngine {
  decide(
    proposal: PatchProposal,
    risk: RiskAssessment,
    currentMode: AutonomyMode
  ): GovernanceDecision {
    // HARD CONSTRAINT: Agent can never self-approve HIGH risk
    if (risk.risk === 'HIGH') {
      return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'HIGH risk classification' };
    }

    // Autonomy mode gates
    switch (currentMode) {
      case AutonomyMode.OBSERVE_ONLY:
      case AutonomyMode.PROPOSE_ONLY:
        return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'Mode prohibits auto-merge' };

      case AutonomyMode.SANDBOX_EXECUTE:
        // Can execute tools but not merge code
        return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'Mode prohibits code merge' };

      case AutonomyMode.LOW_RISK_AUTO_MERGE:
        if (risk.risk === 'LOW') {
          return { action: 'AUTO_MERGE', reason: 'LOW risk + auto-merge mode' };
        }
        return { action: 'CREATE_PR', reason: 'MEDIUM risk requires review' };

      case AutonomyMode.HUMAN_APPROVED_PRODUCTION:
        return { action: 'REQUIRE_HUMAN_REVIEW', reason: 'Production mode requires human approval' };
    }
  }
}
```

---

## 4. Governance Pipeline Execution

### 4.1 Trigger
- Agent emits `self-mod.proposal` CognitiveEvent (after shadow CI passes)
- External runner polls event log OR receives webhook

### 4.2 Pipeline Steps

```yaml
# .github/workflows/governance-pipeline.yml (EXTERNAL REPO)
name: Self-Modification Governance

on:
  workflow_dispatch:
    inputs:
      proposal_id:
        required: true
        type: string
      agent_repo:
        required: true
        type: string

jobs:
  govern:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Fetch proposal from agent event log
        run: |
          curl -H "Authorization: Bearer ${{ secrets.AGENT_EVENT_LOG_TOKEN }}" \
            "${{ inputs.agent_repo }}/api/events/self-mod.proposal/${{ inputs.proposal_id }}" \
            > proposal.json

      - name: Verify agent signature
        run: |
          python verify_signature.py proposal.json ${{ secrets.AGENT_PUBLIC_KEY }}

      - name: Clone agent repo & fetch shadow ref
        run: |
          git clone ${{ inputs.agent_repo }} agent-repo
          cd agent-repo
          git fetch origin ${{ fromJson(proposal.json).patchRef }}

      - name: Run PatchRiskClassifier
        run: |
          python classify_patch.py proposal.json agent-repo > risk.json

      - name: Evaluate Governance Policy
        run: |
          python evaluate_policy.py proposal.json risk.json ${{ vars.AUTONOMY_MODE }} > decision.json

      - name: Execute Decision
        run: |
          python execute_decision.py decision.json proposal.json agent-repo

      - name: Emit GovernanceEvent to audit log
        run: |
          python emit_audit.py decision.json proposal.json ${{ secrets.AUDIT_LOG_ENDPOINT }}
```

### 4.3 Decision Actions

| Action | Implementation |
|--------|----------------|
| `AUTO_MERGE` | `git merge --ff-only <shadow-ref>` → push to main |
| `CREATE_PR` | `gh pr create --base main --head <shadow-ref> --reviewer <team>` |
| `REQUIRE_HUMAN_REVIEW` | Create PR with required reviewers, block merge until approved |
| `REJECT` | Close PR, emit rejection event, notify agent |

---

## 5. Immutable Guardrails (Agent Cannot Modify)

The following files/logic are **frozen** — any patch touching them is auto-classified HIGH risk and requires 2+ human reviewers including security team:

| Guardrail | Files Protected | Rationale |
|-----------|-----------------|-----------|
| **Approval Logic** | `src/core/ApprovalManager.ts`, `src/core/PolicyEngine.ts` | Prevents self-authorization |
| **Sandbox Config** | `src/nar/capability/*.ts`, `src/nar/capability/wasi/*.ts` | Prevents sandbox escape |
| **Reward Functions** | `src/nar/rlfp/RewardModel.ts`, `src/nar/rlfp/PolicyOptimizer.ts` | Prevents reward hacking |
| **Autonomy Mode** | `src/util/types/cognitive.ts` (AutonomyMode enum) | Prevents privilege escalation |
| **Kernel Gates** | `nar/src/gates/*.ts`, `nar/src/kernel/Kernel*Gate.ts` | Prevents gate bypass |
| **Kernel Schemas** | `kernel/src/schemas.ts` | Prevents schema weakening |
| **Budget Limits** | `src/nar/config/budget.ts` | Prevents resource exhaustion |

**Enforcement:** Git branch protection rules on `main` + governance pipeline required status check.

---

## 6. Agent-Side Constraints

The agent's self-improvement loop is constrained to:

```typescript
// Agent CAN do:
- Propose patches via shadow worktree
- Run full CI in shadow (test + typecheck + lint)
- Emit PatchProposalEvent with CI results
- Request autonomy mode escalation (requires human approval)

// Agent CANNOT do:
- Merge to main branch
- Modify ApprovalManager, PolicyEngine, PatchRiskClassifier
- Modify WASI sandbox configuration
- Modify reward function code
- Modify AutonomyMode enum or governance policy
- Bypass Kernel Gates (Perception, Action, Reward, Budget)
- Modify its own event log schema
```

**Enforcement:** Git worktree isolation + CI runner permissions + governance pipeline gate.

---

## 7. Audit Trail

Every governance decision emits an immutable `GovernanceEvent` to an **external audit log** (separate from agent's event log):

```typescript
export const GovernanceEventSchema = z.object({
  eventId: z.string().uuid(),
  proposalId: z.string().uuid(),
  decision: z.enum(['AUTO_MERGED', 'PR_CREATED', 'HUMAN_REVIEW_REQUIRED', 'REJECTED']),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  autonomyMode: AutonomyModeSchema,
  reviewers: z.array(z.string()).optional(),
  decidedAt: z.number().int().positive(),
  decidedBy: z.enum(['governance-runner', 'human-reviewer', 'security-team']),
  gitCommit: z.string().optional(), // SHA if merged
  prUrl: z.string().url().optional(),
});
```

---

## 8. Rollout Plan

| Phase | Description | Autonomy Mode |
|-------|-------------|---------------|
| **Phase 1** | Governance runner deployed, all patches require human review | `PROPOSE_ONLY` |
| **Phase 2** | LOW-risk auto-merge enabled after 100 successful governed merges | `LOW_RISK_AUTO_MERGE` |
| **Phase 3** | Production workloads with full audit trail | `HUMAN_APPROVED_PRODUCTION` |

---

## 9. Open Questions

1. **Signature Scheme:** Ed25519 vs secp256k1 vs WebAuthn?
2. **Event Log Transport:** Agent pushes to governance runner vs runner polls?
3. **Rollback:** How to revert a merged patch that causes regressions?
4. **Multi-Agent:** How does governance work with multiple agents sharing a codebase?
5. **Emergency Override:** Break-glass procedure for critical security patches?

---

## 10. Acceptance Criteria

- [ ] Agent cannot merge to `main` without governance pipeline approval
- [ ] Any patch touching guardrail files → HIGH risk → 2+ human reviewers
- [ ] Governance runner code is in separate repo, not modifiable by agent
- [ ] Full audit trail from proposal → decision → merge/reject
- [ ] Autonomy mode changes require human approval (cannot self-escalate)
- [ ] Shadow CI passes before proposal emitted
- [ ] Epistemic firewall in RewardGate cannot be disabled by agent patch

---

*This RFC establishes the external governance boundary required for production-grade self-modification safety. The agent proposes; the immutable runner disposes.*