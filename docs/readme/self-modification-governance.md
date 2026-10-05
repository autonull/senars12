## Self-Modification Governance

Self-modification is only acceptable if every change is isolated, tested, risk-classified, and (above low risk) externally approved. The machinery below enforces that.

### Self-Tools (8 Tools, Shadow Execution)

| Tool | Self-Operation | Implementation |
|------|----------------|----------------|
| `register_rule` | `(^promote_rule($schema))!` | Add schema to RuleRegistry |
| `register_tool` | `(^add_capability($cap))!` | ToolManager.register() |
| `scaffold_capability` | `(^scaffold($tmpl, $cap))!` | Fill template → `codemod` in shadow worktree |
| `apply_fix` | `(apply_fix^($fix))!` | Lookup fix pattern → `codemod` in shadow worktree |
| `tune_knob` | `(^apply_tuning($knob, $val))!` | RLFPLearner.applyTuningUpdate() |
| `switch_strategy` | `(select_strategy^($strat))!` | CognitiveController / StrategyRegistry |
| `run_tests_shadow` | Validation | Full CI (`pnpm test && pnpm typecheck && pnpm lint`) in shadow |
| `run_scenario_shadow` | Validation | Cognitive scenarios in shadow |

**Shadow Execution Safety:**
1. Create git worktree: `git worktree add .shadow/fix-42`
2. Apply codemod in `.shadow/fix-42`
3. Run **full CI** (test + typecheck + lint) in shadow
4. If green: present diff to ApprovalManager
5. If approved: merge worktree → main
6. Cleanup: `git worktree remove .shadow/fix-42`

### RLFP on Task Outcomes (Unified + Intrinsic Rewards)

```typescript
interface TaskOutcome {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune' | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>;
}

// Extrinsic (existing)
reward_extrinsic = 0.5 * passRate + 0.3 * clamp(baseline/current, 0, 2)/2 + 0.2 * coverageDelta - AIKR penalties;

// Intrinsic (new)
reward_intrinsic = 
  0.4 * derivationDepthReduction +    // schema promotion → fewer steps
  0.3 * selfModelAccuracy +           // predicted vs actual capability
  0.3 * contradictionReduction;       // coherence improvement

reward = clamp(reward_extrinsic + 0.3 * reward_intrinsic, -1, 1);
```

### Goal→Tool Dispatch (Semantic, Native AST)

```typescript
// Narsese operation goal: apply_fix(null_check-->fix_pattern)
// Parses to: operation(Atom('apply_fix'), Inheritance(Atom('null_check'), Atom('fix_pattern')))
async executeToolGoal(goalTerm: Term): Promise<ToolResult> {
  // The term's kind says it is a call; the operation's name and arguments say which
  const call = readOperationTerm(goalTerm);   // { name: 'apply_fix', args: {...} }
  if (!call) return errorResult('not an operation term');
  return this.execute(call.name, await resolveSemanticArgs(call.name, call.args));
}
```

### Cognitive State Observability

Structured cognitive state emitted every 10 cycles:

```json
{
  "timestamp": "2026-09-08T...",
  "cycle": 128,
  "active_drives": { "competence": 0.8, "curiosity": 0.2, "coherence": 0.9, "social": 0.1 },
  "active_meta_goals": ["apply_fix((null_check-->fix_pattern))", "promote_rule((schema_42-->rule))"],
  "pending_tool_executions": ["apply_fix (shadow worktree .shadow/fix-42)"],
  "aikr_pressure": "low",
  "rlfp_reward_avg": 0.34,
  "self_quality": 0.85
}
```

CLI: `pnpm exec tsx src/bin/self-report.ts`

### Governance Pipeline

**In-repo prototype:**
- `PatchRiskClassifier` scores patches against guard-rail file list (approval logic, sandbox config, reward functions, autonomy mode, kernel gates, schemas, budget limits).
- `GovernancePolicyEngine` combines risk + current `AutonomyMode` → `{AUTO_MERGE, CREATE_PR, REQUIRE_HUMAN_REVIEW, REJECT}`.
- `ProposalRouter` consumes `SelfRewardGate` proposals: low-risk `focus-weight` auto-applies, medium → sandbox validation, high → human approval.
- `SandboxValidator` auto-approves in-range `knob-tune` proposals (range checked vs `rlfp/knobSchema`).

**External Governance Model (Required for Production):**
- The agent *proposes* patches via shadow worktree + CI validation
- An **external, immutable CI/CD runner** evaluates risk and applies the merge
- The agent **cannot** edit its own sandbox config, approval policies, or reward functions
- `AutonomyMode` enum: `observe-only` → `propose-only` → `sandbox-execute` → `low-risk-auto-merge` → `human-approved-production`

These capabilities build on the existing shadow execution safety (git worktree + full CI + ApprovalManager) and the unified RLFP reward signal (extrinsic + intrinsic).
