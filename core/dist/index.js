import {
  APPROVAL_TIMEOUT_MS,
  AgentCapabilities,
  BUILTIN_LENS_IDS,
  CONNECTION_COLORS,
  ChatMessage,
  CognitiveDelta,
  ConfigField,
  EDGE_LABELS,
  EDGE_TYPES,
  GraphNodeData,
  GraphNodeDataStrict,
  GraphOp,
  IncomingFromClient,
  IncomingFromServer,
  LENS_COLORS_HEX,
  LENS_DESCRIPTIONS,
  LENS_FIELDS,
  LENS_LABELS,
  LMSwitchMsg,
  Lens,
  LensSpecSchema,
  MettaAtomNode,
  MettaSkillNode,
  ModulationSchema,
  NarConceptNode,
  SHELL_TIMEOUT_MS,
  ServerError,
  SourceQualitySchema,
  TaskTypeSchema,
  TruthValueSchema,
  WEB_FETCH_TIMEOUT_MS,
  __privateAdd,
  __privateGet,
  __privateMethod,
  __privateSet,
  __privateWrapper,
  __publicField,
  builtinLensSpecs,
  edgeTypeLabel,
  external_exports,
  isBuiltinLens,
  lensSpecToJsonSchema,
  taskTypeForPunctuation
} from "./chunk-WLHISKGT.js";

// src/index.ts
import {
  clamp as clamp2,
  clamp01,
  compact,
  createLogger as createLogger2,
  defaultLogger,
  edgeKey,
  ensureArray,
  errMsg as errMsg8,
  estimateTokens as estimateTokens2,
  extractTerm,
  generateId as generateId4,
  isNarsese,
  isNil,
  Logger,
  makeId as makeId4,
  registerLogEnricher,
  sleep,
  toError as toError2
} from "@senars/util";
import {
  agentOptionsSchema,
  contextOptsSchema
} from "@senars/util/config";

// src/Agent.ts
import {
  appendTextDelta,
  generateId as generateId3,
  incrementCount,
  makeId as makeId2,
  mapToRecord,
  Signal
} from "@senars/util";

// src/ApprovalService.ts
import { deferred, errMsg, makeId, withTimeout } from "@senars/util";
import { envBool } from "@senars/util/config";
var _InMemoryApprovalManager_instances, take_fn;
var InMemoryApprovalManager = class {
  constructor(opts = {}) {
    __publicField(this, "opts", opts);
    __privateAdd(this, _InMemoryApprovalManager_instances);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
  }
  createRequest(request, metadata = {}) {
    const id = makeId();
    const { promise: result, resolve } = deferred();
    const req = {
      id,
      request,
      metadata,
      createdAt: Date.now(),
      result,
      resolve
    };
    this.pending.set(id, req);
    this.opts.onRequest?.(req);
    return req;
  }
  resolveApproval(id, approved, reason2) {
    const req = __privateMethod(this, _InMemoryApprovalManager_instances, take_fn).call(this, id);
    if (!req) return false;
    req.resolve({ approved, reason: reason2 });
    return true;
  }
  getPending() {
    return [...this.pending.values()];
  }
  getPendingCount() {
    return this.pending.size;
  }
};
_InMemoryApprovalManager_instances = new WeakSet();
take_fn = function(id) {
  const req = this.pending.get(id);
  this.pending.delete(id);
  return req;
};
var ApprovalService = class {
  constructor(config = {}) {
    __publicField(this, "approvalManager");
    this.approvalManager = config.approvalManager ?? new InMemoryApprovalManager();
  }
  async requestApproval(params) {
    const request = `${params.action}

Payload: ${params.payload}
Risk: ${params.risk}`;
    const approvalRequest = this.approvalManager.createRequest(request, {
      action: params.action,
      risk: params.risk
    });
    if (envBool("CI") || envBool("SENARS_HEADLESS")) {
      const feedback = "Auto-rejected: headless mode";
      this.approvalManager.resolveApproval(approvalRequest.id, false, feedback);
      return { approved: false, feedback };
    }
    try {
      const result = await withTimeout(
        approvalRequest.result,
        params.timeoutMs ?? APPROVAL_TIMEOUT_MS,
        () => new Error("Approval timeout")
      );
      return { approved: result.approved, feedback: result.reason };
    } catch (err) {
      const feedback = `Approval error: ${errMsg(err)}`;
      this.approvalManager.resolveApproval(approvalRequest.id, false, feedback);
      return { approved: false, feedback };
    }
  }
};

// src/agent/phases.ts
import {
  collectText,
  createLogger,
  dispatch,
  drain,
  egressVerdict,
  toolError
} from "@senars/util";

// src/engine/sweep.ts
import { errMsg as errMsg2 } from "@senars/util";
var invokeEngineHook = (engine, hook) => Promise.resolve(engine[hook]?.call(engine));
async function sweepEngines(engines, work, onError) {
  if (!engines) return [];
  const results = [];
  for (const [id, engine] of engines) {
    try {
      const value = await work(engine, id);
      if (value !== void 0) results.push(value);
    } catch (error) {
      onError?.(id, errMsg2(error));
    }
  }
  return results;
}

// src/memory/types.ts
var RECALL_WINDOW = 50;
var WORKING_MEMORY_CAPACITY = 1e3;

// src/schemas/event-base.ts
import { ENGINE_ORIGINS } from "@senars/util";
import { timestamp } from "@senars/util/config";
var EngineOriginSchema = external_exports.enum(ENGINE_ORIGINS);
var CognitiveEventBaseSchema = external_exports.object({
  engine: EngineOriginSchema,
  timestamp,
  correlationId: external_exports.string(),
  causationId: external_exports.string().optional(),
  /**
   * The log's own append-order key — a ULID, not a UUID, because both logs
   * range-scan on it. Opaque to the schema and never minted as a payload field,
   * which is where the UUID requirement below belongs.
   */
  id: external_exports.string().optional()
});
var PROPOSER_ORIGIN = "proposer";
var NAR_ORIGIN = "nar";

// src/schemas/cognitive-events.ts
import {
  BandDecisionSchema,
  CognitiveAxisSchema,
  generateId,
  JudgmentShapeSchema
} from "@senars/util";
import { intBetween, nonNegativeInt as nonNegativeInt7, unitInterval as unitInterval3, uuid as uuid3, validatorFor as validatorFor5 } from "@senars/util/config";

// src/schemas/common.ts
import { HistoryEntrySchema } from "@senars/util";
import { nonEmpty, nonNegativeInt, unitInterval } from "@senars/util/config";
var RulePatternSideSchema = external_exports.object({ op: nonEmpty });
var RulePatternSchema = external_exports.object({
  left: RulePatternSideSchema,
  right: RulePatternSideSchema
});
var BudgetSchema = external_exports.object({
  priority: unitInterval,
  durability: unitInterval,
  quality: unitInterval,
  cycles: nonNegativeInt,
  depth: nonNegativeInt
});
var INDEPENDENCE = ["independent", "dependent", "unknown"];
var IndependenceSchema = external_exports.enum(INDEPENDENCE);

// src/schemas/governance.ts
import { CapabilityRiskSchema } from "@senars/util";
import { nonNegativeInt as nonNegativeInt2, positiveInt, timestamp as timestamp2, uuid } from "@senars/util/config";
var AutonomyModeSchema = external_exports.enum([
  "observe-only",
  "propose-only",
  "sandbox-execute",
  "low-risk-auto-merge",
  "human-approved-production"
]);
var AUTONOMITY_AUTHORITIES = ["system", "human", "external-governance"];
var AutonomyAuthoritySchema = external_exports.enum(AUTONOMITY_AUTHORITIES);
var RISK_LEVEL_BY_CAPABILITY_RISK = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH"
};
var RISK_LEVELS = Object.values(RISK_LEVEL_BY_CAPABILITY_RISK);
var RiskLevelSchema = external_exports.enum(RISK_LEVELS);
var GameDomainSchema = external_exports.enum(["external", "self"]);
var RewardDomainSchema = external_exports.enum([
  "external-reflex",
  "self-scheduler",
  "self-config-proposal",
  "self-patch-score",
  "self-explanation-rank"
]);
var PatchProposalSchema = external_exports.object({
  proposalId: uuid,
  patchRef: external_exports.string(),
  baseCommit: external_exports.string(),
  patchDiff: external_exports.string(),
  ciResults: external_exports.object({
    test: external_exports.boolean(),
    typecheck: external_exports.boolean(),
    lint: external_exports.boolean(),
    durationMs: positiveInt
  }),
  riskSelfAssessment: RiskLevelSchema,
  affectedComponents: external_exports.array(
    external_exports.enum([
      "approval-logic",
      "sandbox-config",
      "reward-functions",
      "autonomy-mode",
      "kernel-gates",
      "cognitive-params",
      "tools",
      "rules",
      "memory",
      "other"
    ])
  ),
  affectedFiles: external_exports.array(external_exports.string()),
  linesAdded: nonNegativeInt2,
  linesRemoved: nonNegativeInt2,
  coverageDelta: external_exports.number().optional(),
  rationale: external_exports.string(),
  timestamp: timestamp2,
  agentSignature: external_exports.string(),
  correlationId: external_exports.string().optional()
});
var SelfImprovementProposalSchema = external_exports.object({
  proposalId: uuid,
  kind: external_exports.enum([
    "knob-tune",
    "focus-weight",
    "strategy-switch",
    "schema-promotion",
    "patch-apply",
    "test-generate",
    "schema-evolution",
    "metta-rule-adoption"
  ]),
  riskTier: CapabilityRiskSchema,
  payload: external_exports.record(external_exports.string(), external_exports.unknown()),
  rewardDomain: RewardDomainSchema,
  correlationId: external_exports.string().optional()
});
var RiskAssessmentSchema = external_exports.object({
  risk: RiskLevelSchema,
  score: nonNegativeInt2,
  factors: external_exports.array(
    external_exports.object({
      factor: external_exports.string(),
      file: external_exports.string().optional(),
      component: external_exports.string().optional(),
      severity: RiskLevelSchema
    })
  )
});
var GovernanceDecisionSchema = external_exports.object({
  action: external_exports.enum(["AUTO_MERGE", "CREATE_PR", "REQUIRE_HUMAN_REVIEW", "REJECT"]),
  reason: external_exports.string(),
  reviewers: nonNegativeInt2.optional()
});
var GovernanceEventSchema = external_exports.object({
  eventId: uuid,
  proposalId: uuid,
  decision: external_exports.enum(["AUTO_MERGED", "PR_CREATED", "HUMAN_REVIEW_REQUIRED", "REJECTED"]),
  riskLevel: RiskLevelSchema,
  autonomyMode: AutonomyModeSchema,
  decidedAt: timestamp2,
  decidedBy: external_exports.enum(["governance-runner", "human-reviewer", "security-team"])
});

// src/schemas/nar-events.ts
import { HEALTH_STATUSES } from "@senars/util";
var NarBase = CognitiveEventBaseSchema.extend({ engine: external_exports.literal("nar") });
var InputUserEventSchema = NarBase.extend({
  type: external_exports.literal("input.user"),
  payload: external_exports.object({ text: external_exports.string(), source: external_exports.string() })
});
var DerivationMadeEventSchema = NarBase.extend({
  type: external_exports.literal("derivation.made"),
  payload: external_exports.object({
    rule: external_exports.string(),
    premises: external_exports.array(external_exports.string()),
    conclusion: external_exports.string(),
    cpuMs: external_exports.number().optional(),
    lmCalls: external_exports.number().optional(),
    lmTokens: external_exports.number().optional()
  })
});
var AtomDerivedEventSchema = NarBase.extend({
  type: external_exports.literal("atom.derived"),
  payload: external_exports.object({ atom: external_exports.string(), space: external_exports.string() })
});
var AtomRetractedEventSchema = NarBase.extend({
  type: external_exports.literal("atom.retracted"),
  payload: external_exports.object({ atom: external_exports.string(), space: external_exports.string() })
});
var BeliefAddedEventSchema = NarBase.extend({
  type: external_exports.literal("belief.added"),
  payload: external_exports.object({ term: external_exports.string(), truth: TruthValueSchema })
});
var BeliefRetractedEventSchema = NarBase.extend({
  type: external_exports.literal("belief.retracted"),
  payload: external_exports.object({ term: external_exports.string() })
});
var DriveChangedEventSchema = NarBase.extend({
  type: external_exports.literal("drive.changed"),
  payload: external_exports.object({ drive: external_exports.string(), urgency: external_exports.number() })
});
var GoalAchievedEventSchema = NarBase.extend({
  type: external_exports.literal("goal.achieved"),
  payload: external_exports.object({ goal: external_exports.string() })
});
var GoalFailedEventSchema = NarBase.extend({
  type: external_exports.literal("goal.failed"),
  payload: external_exports.object({ goal: external_exports.string(), reason: external_exports.string() })
});
var SkillExecutedEventSchema = NarBase.extend({
  type: external_exports.literal("skill.executed"),
  payload: external_exports.object({
    skill: external_exports.string(),
    args: external_exports.array(external_exports.string()),
    result: external_exports.string(),
    durationMs: external_exports.number()
  })
});
var ToolRequestEventSchema = NarBase.extend({
  type: external_exports.literal("tool.request"),
  payload: external_exports.object({
    toolName: external_exports.string(),
    args: external_exports.record(external_exports.string(), external_exports.unknown()),
    timeoutMs: external_exports.number().optional()
  })
});
var ToolResponseEventSchema = NarBase.extend({
  type: external_exports.literal("tool.response"),
  payload: external_exports.object({
    requestId: external_exports.string(),
    toolName: external_exports.string(),
    result: external_exports.unknown().optional(),
    error: external_exports.string().optional(),
    durationMs: external_exports.number()
  })
});
var ConfigBase = {
  payload: external_exports.object({ path: external_exports.string() })
};
var ConfigSetEventSchema = NarBase.extend({
  type: external_exports.literal("config.set"),
  payload: external_exports.object({ path: external_exports.string(), value: external_exports.unknown() })
});
var ConfigDeleteEventSchema = NarBase.extend({
  type: external_exports.literal("config.delete"),
  ...ConfigBase
});
var ConfigSchemaEventSchema = NarBase.extend({
  type: external_exports.literal("config.schema"),
  payload: external_exports.object({ schema: external_exports.unknown() })
});
var KernelReadyEventSchema = NarBase.extend({
  type: external_exports.literal("kernel.ready"),
  payload: external_exports.object({ backendIds: external_exports.array(external_exports.string()) })
});
var BackendRegisteredEventSchema = NarBase.extend({
  type: external_exports.literal("backend.registered"),
  payload: external_exports.object({ manifest: external_exports.unknown() })
});
var BootstrapEventSchema = NarBase.extend({
  type: external_exports.literal("bootstrap"),
  payload: external_exports.object({
    beliefs: external_exports.array(external_exports.string()).optional(),
    atoms: external_exports.array(external_exports.object({ atom: external_exports.string(), space: external_exports.string().optional() })).optional(),
    skills: external_exports.array(external_exports.object({ name: external_exports.string(), code: external_exports.string() })).optional()
  })
});
var CycleEventSchema = NarBase.extend({
  type: external_exports.literal("cycle"),
  cycle: external_exports.number(),
  derived: external_exports.number(),
  payload: external_exports.object({ cycle: external_exports.number(), derived: external_exports.number() })
});
var HealthEventSchema = NarBase.extend({
  type: external_exports.literal("health"),
  payload: external_exports.object({
    status: external_exports.enum(HEALTH_STATUSES),
    cycleCount: external_exports.number(),
    errorRate: external_exports.number(),
    /** Per-engine fault counts behind `errorRate`, as `Agent.health()` reports them. */
    byEngine: external_exports.record(external_exports.string(), external_exports.number()).optional()
  })
});
var ConflictDetectedEventSchema = NarBase.extend({
  type: external_exports.literal("conflict:detected"),
  payload: external_exports.object({ term: external_exports.string(), conflictWith: external_exports.string() })
});
var NarEventSchemas = [
  InputUserEventSchema,
  DerivationMadeEventSchema,
  AtomDerivedEventSchema,
  AtomRetractedEventSchema,
  BeliefAddedEventSchema,
  BeliefRetractedEventSchema,
  DriveChangedEventSchema,
  GoalAchievedEventSchema,
  GoalFailedEventSchema,
  SkillExecutedEventSchema,
  ToolRequestEventSchema,
  ToolResponseEventSchema,
  ConfigSetEventSchema,
  ConfigDeleteEventSchema,
  ConfigSchemaEventSchema,
  KernelReadyEventSchema,
  BackendRegisteredEventSchema,
  BootstrapEventSchema,
  CycleEventSchema,
  HealthEventSchema,
  ConflictDetectedEventSchema
];

// src/schemas/proposal.ts
import {
  nonEmpty as nonEmpty3,
  nonNegativeInt as nonNegativeInt4,
  positiveInt as positiveInt3,
  unitInterval as unitInterval2,
  validatorFor as validatorFor2
} from "@senars/util/config";

// src/schemas/rule-table.ts
import { nonEmpty as nonEmpty2, nonNegativeInt as nonNegativeInt3, positiveInt as positiveInt2, validatorFor } from "@senars/util/config";
var RuleProvenanceSchema = external_exports.discriminatedUnion("kind", [
  /** Shipped with the code. Its body is a named NAL function. */
  external_exports.object({ kind: external_exports.literal("builtin") }),
  /** Admitted from a `proposal.admitted` event. Reverting it is a table operation. */
  external_exports.object({
    kind: external_exports.literal("proposal"),
    /** The proposal that produced it — the same id as the committed event. */
    proposalId: nonEmpty2,
    /** The producer that proposed it, for the operator-facing audit surface. */
    producer: nonEmpty2.optional()
  }),
  /** Deserialised from a persisted artifact rather than built in. */
  external_exports.object({ kind: external_exports.literal("import"), source: nonEmpty2 })
]);
var RuleDeclarationSchema = external_exports.object({
  ruleId: nonEmpty2,
  description: external_exports.string(),
  ...RulePatternSchema.shape,
  /** The name of the truth function the rule dispatches through, e.g. `deduction`. */
  truthFn: nonEmpty2,
  /** The name the body resolves under, e.g. `deduction` in `NALRules`. */
  body: nonEmpty2,
  priority: external_exports.number(),
  taskType: TaskTypeSchema.optional()
});
var RuleArtifactEntrySchema = RuleDeclarationSchema.extend({
  /** The artifact version this entry was declared under. */
  artifactVersion: nonEmpty2,
  /** The table revision this entry became part of. Monotonic. */
  ruleSetRevision: nonNegativeInt3,
  /** The base revision the admission was judged against; `null` for a builtin. */
  parentRevision: nonNegativeInt3.nullable(),
  /** The declaration's own schema version, so one entry can be migrated alone. */
  ruleSchemaVersion: positiveInt2,
  provenance: RuleProvenanceSchema,
  /** The `proposal.admitted` event, when there was one. The log and the table cannot disagree. */
  eventId: external_exports.string().optional()
});
var RuleTableSchema = external_exports.object({
  schemaVersion: positiveInt2,
  artifactVersion: nonEmpty2,
  /** The revision this artifact states. Not inferred from the entries. */
  revision: nonNegativeInt3,
  entries: external_exports.array(RuleArtifactEntrySchema)
});
var validateRuleTable = validatorFor(RuleTableSchema, "RuleTable");

// src/schemas/proposal.ts
var PROPOSAL_KINDS = ["content", "rule"];
var EnvelopeSchema = external_exports.object({
  proposalId: nonEmpty3,
  schemaVersion: positiveInt3,
  /**
   * The committed revision the proposer observed. A proposal whose base is
   * behind the revision at the boundary is **stale** and is rejected — applying
   * it would resolve a conflict the proposer could not have seen (§3.3).
   */
  baseRevision: nonNegativeInt4,
  /** Cycles between proposals: the trigger is a work budget, never a wall clock. */
  cyclesPerProposal: positiveInt3,
  issuedAtCycle: nonNegativeInt4,
  /**
   * Terms this proposal read. On the envelope because both kinds read them and
   * the applicability rule checks them identically — hoisting it also leaves the
   * two payloads disjoint, so neither can be read as the other.
   */
  references: external_exports.array(external_exports.string())
});
var ContentProposalSchema = EnvelopeSchema.extend({
  kind: external_exports.literal("content"),
  payload: external_exports.object({
    taskType: TaskTypeSchema,
    term: nonEmpty3,
    truth: TruthValueSchema.optional()
  })
});
var RuleProposalSchema = EnvelopeSchema.extend({
  payload: external_exports.object({
    ruleId: nonEmpty3,
    name: nonEmpty3,
    pattern: RulePatternSchema,
    /** The named truth function the rule dispatches through. */
    truthFn: nonEmpty3,
    priority: unitInterval2,
    /** The NAL rule body implementation name (e.g., 'nal.deduction'). Optional in wire format; validated at the boundary. */
    body: external_exports.string().optional(),
    /** Pure-NAL symbolic fallback name for LM failure escalation (e.g., 'lm-narsese-translation'). Optional in wire format; validated at the boundary. */
    symbolicFallback: external_exports.string().optional()
  }),
  kind: external_exports.literal("rule")
});
var ProposalSchema = external_exports.discriminatedUnion("kind", [
  ContentProposalSchema,
  RuleProposalSchema
]);
var PROPOSAL_REJECTIONS = [
  "schema-version",
  "stale-revision",
  "evicted-reference",
  "queue-overflow",
  "cancelled",
  "failed-schema"
];
var ProposalRejectedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("proposal.rejected"),
  engine: external_exports.literal(PROPOSER_ORIGIN),
  payload: external_exports.object({
    proposalId: external_exports.string(),
    kind: external_exports.enum(PROPOSAL_KINDS),
    reason: external_exports.enum(PROPOSAL_REJECTIONS),
    detail: external_exports.string(),
    /** The revision at the boundary the proposal was judged against. */
    observedRevision: nonNegativeInt4
  })
});
var ProposalAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("proposal.admitted"),
  engine: external_exports.literal(PROPOSER_ORIGIN),
  payload: external_exports.object({
    proposalId: external_exports.string(),
    kind: external_exports.enum(PROPOSAL_KINDS),
    schemaVersion: positiveInt3,
    baseRevision: nonNegativeInt4,
    /** The revision this admission produced. The event is the source of truth for it. */
    resultingRevision: positiveInt3,
    /**
     * A rule admission carries the declaration it admitted, so the table can be
     * reconstructed from the log alone (TODO29.a §5.10). Absent for a content
     * proposal, which changes no table: its payload travels with the task it
     * admitted rather than in the table.
     */
    declaration: RuleDeclarationSchema.optional(),
    /** The proposer that issued it, for the operator-facing audit surface. */
    producer: external_exports.string().optional()
  })
});
var validateProposal = validatorFor2(ProposalSchema, "Proposal");

// src/schemas/reasoning-budget.ts
import { nonNegativeInt as nonNegativeInt5, positiveInt as positiveInt4, validatorFor as validatorFor3 } from "@senars/util/config";
var BUDGET_SCOPE_IDS = [
  "derivations",
  "premises",
  "candidate-derivations",
  "proposal-application",
  "control-work",
  "decision-derivations"
];
var TerminationReasonSchema = external_exports.enum([
  "cycle-budget",
  "depth-budget",
  "memory-budget",
  "llm-budget",
  "deadline",
  "backpressure",
  "aborted",
  "completed"
]);
var ConsumedBudgetSchema = external_exports.object({
  cycles: nonNegativeInt5.default(0),
  depth: nonNegativeInt5.default(0),
  memoryOps: nonNegativeInt5.default(0),
  llmCalls: nonNegativeInt5.default(0)
});
var BUDGET_TYPES = {
  cycles: "cycles",
  depth: "depth",
  memoryOps: "memory",
  llmCalls: "llm"
};
var BudgetTypeSchema = external_exports.enum(Object.values(BUDGET_TYPES));
var zeroConsumed = () => ({
  cycles: 0,
  depth: 0,
  memoryOps: 0,
  llmCalls: 0
});
var ReasoningBudgetSchema = external_exports.object({
  maxCycles: positiveInt4,
  maxDepth: positiveInt4,
  maxMemoryOps: positiveInt4,
  maxLMCalls: nonNegativeInt5,
  wallclockDeadlineMs: positiveInt4.optional(),
  abortSignal: external_exports.unknown().optional(),
  // AbortSignal - cannot serialize, validated at runtime
  terminationReason: TerminationReasonSchema.optional(),
  consumed: ConsumedBudgetSchema.default(zeroConsumed)
});
var validateReasoningBudget = validatorFor3(ReasoningBudgetSchema, "ReasoningBudget");

// src/schemas/derivation-records.ts
import { nonNegativeInt as nonNegativeInt6, timestamp as timestamp3, uuid as uuid2, validatorFor as validatorFor4 } from "@senars/util/config";
var DerivationStepSchema = external_exports.object({
  stepId: uuid2,
  ruleId: external_exports.string(),
  ruleCategory: external_exports.enum([
    "core",
    "logic",
    "propositional",
    "higher-order",
    "comparison",
    "classical",
    "structural",
    "temporal",
    "procedural",
    "meta-cognitive",
    "variable"
  ]),
  premises: external_exports.array(external_exports.string()),
  // Term strings
  conclusion: external_exports.string(),
  // Term string
  truth: TruthValueSchema,
  /**
   * The truth function the producing rule *declared*, as its name in the NAL
   * algebra. Optional because records written before the name was carried do
   * not have one; when present it is authoritative and needs no rule-id guess.
   */
  truthFn: external_exports.string().optional(),
  substitution: external_exports.record(external_exports.string(), external_exports.string()).optional(),
  // Variable bindings
  premiseTruths: external_exports.array(TruthValueSchema).optional(),
  // Truth of each premise, in order — enables standalone truth-algebra verification
  evidenceLineage: external_exports.array(uuid2),
  // Parent derivation IDs
  independence: IndependenceSchema
});
var DerivationRecordSchema = external_exports.object({
  derivationId: uuid2,
  taskId: uuid2,
  goalTerm: external_exports.string(),
  steps: external_exports.array(DerivationStepSchema),
  finalTruth: TruthValueSchema,
  totalCycles: nonNegativeInt6,
  maxDepthReached: nonNegativeInt6,
  timestamp: timestamp3,
  engine: external_exports.literal("nar")
});
var validateDerivationRecord = validatorFor4(DerivationRecordSchema, "DerivationRecord");

// src/schemas/cognitive-events.ts
var STIMULUS_SOURCES = ["user", "llm", "derivation", "reflex", "sensor"];
var StimulusSourceSchema = external_exports.enum(STIMULUS_SOURCES);
var TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("task.admitted"),
  payload: external_exports.object({
    taskId: uuid3,
    term: external_exports.string(),
    taskType: TaskTypeSchema,
    truth: TruthValueSchema.optional(),
    source: StimulusSourceSchema,
    budget: BudgetSchema
  })
});
var DerivationAcceptedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("derivation.accepted"),
  payload: external_exports.object({
    derivationId: uuid3,
    ruleId: external_exports.string(),
    premises: external_exports.array(external_exports.string()),
    conclusion: external_exports.string(),
    truth: TruthValueSchema,
    evidenceLineage: external_exports.array(uuid3),
    independenceCheck: IndependenceSchema
  })
});
var DerivationRecordEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("derivation.record"),
  payload: DerivationRecordSchema
});
var BeliefRevisedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("belief.revised"),
  payload: external_exports.object({
    term: external_exports.string(),
    oldTruth: TruthValueSchema,
    newTruth: TruthValueSchema,
    /** Absent on the nar family's revision events: the engine records the rule, not the log. */
    evidenceLineage: external_exports.array(uuid3).optional(),
    revisionRule: external_exports.string().optional()
  })
});
var ConceptActivatedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("concept.activated"),
  payload: external_exports.object({
    term: external_exports.string(),
    priority: external_exports.number(),
    /** Which subsystem woke the concept. Absent on `engine: 'nar'` events, which are minted by the bridge from a term's creation. */
    activationSource: external_exports.enum(["perception", "goal", "derivation", "decay", "associative"]).optional()
  })
});
var BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("budget.exhausted"),
  payload: external_exports.object({
    budgetType: BudgetTypeSchema,
    remaining: external_exports.number(),
    limit: external_exports.number(),
    terminationReason: TerminationReasonSchema
  })
});
var PolicyViolationEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("policy.violation"),
  payload: external_exports.object({
    policyId: external_exports.string(),
    violationType: external_exports.enum([
      "unauthorized-tool",
      "budget-exceeded",
      "epistemic-firewall",
      "sandbox-escape",
      "self-mod-unauthorized"
    ]),
    detail: external_exports.string(),
    severity: external_exports.enum(["warn", "block", "quarantine"])
  })
});
var AutonomyModeChangedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("autonomy.mode.changed"),
  payload: external_exports.object({
    previousMode: AutonomyModeSchema,
    newMode: AutonomyModeSchema,
    authorizedBy: AutonomyAuthoritySchema
  })
});
var SelfModProposalEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("self-mod.proposal"),
  payload: PatchProposalSchema
});
var JudgmentResolvedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("judgment.resolved"),
  payload: external_exports.object({
    queryId: external_exports.string(),
    shape: JudgmentShapeSchema,
    axis: CognitiveAxisSchema,
    backendId: external_exports.string(),
    tier: intBetween(0, 3),
    latencyMs: nonNegativeInt7,
    entropy: external_exports.number().optional(),
    abstained: external_exports.boolean(),
    stampType: external_exports.enum(["standard", "provisional"]),
    calibrationVersion: external_exports.string(),
    /** H5/X18: encoder identity digest bound to the head that produced this proposition. */
    encoderDigest: external_exports.string().optional(),
    /** TODO23: judgment provenance (model/calibration/input digests + router band). */
    modelDigest: external_exports.string().optional(),
    calibrationDigest: external_exports.string().optional(),
    inputDigest: external_exports.string().optional(),
    decisionBand: BandDecisionSchema.optional(),
    cost: external_exports.object({
      tokensIn: nonNegativeInt7,
      tokensOut: nonNegativeInt7,
      computeMs: nonNegativeInt7,
      memoryMb: external_exports.number().nonnegative()
    })
  })
});
var EgressGateRejectedEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("egress.gate.rejected"),
  payload: external_exports.object({
    gate: external_exports.enum(["groundedness", "risk"]),
    score: unitInterval3.optional(),
    detail: external_exports.string().optional()
  })
});
var ShadowValidationDropEventSchema = CognitiveEventBaseSchema.extend({
  type: external_exports.literal("shadow.validation.dropped"),
  payload: external_exports.object({
    candidateTerm: external_exports.string(),
    source: external_exports.enum(["llm", "bridge-llm"]),
    conflictType: external_exports.enum(["frequency", "semantic"]),
    frequencyDelta: external_exports.number().optional(),
    semanticScore: external_exports.number().optional()
  })
});
var CognitiveEventSchema = external_exports.discriminatedUnion("type", [
  TaskAdmittedEventSchema,
  DerivationAcceptedEventSchema,
  DerivationRecordEventSchema,
  BeliefRevisedEventSchema,
  ConceptActivatedEventSchema,
  BudgetExhaustedEventSchema,
  PolicyViolationEventSchema,
  AutonomyModeChangedEventSchema,
  SelfModProposalEventSchema,
  JudgmentResolvedEventSchema,
  EgressGateRejectedEventSchema,
  ShadowValidationDropEventSchema,
  ProposalAdmittedEventSchema,
  ProposalRejectedEventSchema,
  ...NarEventSchemas
]);
var mintCognitiveEvent = (type, draft) => ({
  ...draft,
  type,
  timestamp: draft.timestamp ?? Date.now(),
  correlationId: draft.correlationId ?? generateId("corr")
});
var validateCognitiveEvent = validatorFor5(CognitiveEventSchema, "CognitiveEvent");
var isNarEvent = (e) => e.engine === "nar";
var isEventType = (type) => (e) => e.type === type;

// src/schemas/formalization.ts
import { nonNegativeInt as nonNegativeInt8, unitInterval as unitInterval4, uuid as uuid4, validatorFor as validatorFor6 } from "@senars/util/config";
var AMBIGUITY_TYPES = [
  "parse",
  "intent",
  "term",
  "reference",
  "quantifier",
  "modal",
  "temporal",
  "negation"
];
var AMBIGUITY_SEVERITIES = [
  "low",
  "medium",
  "high"
];
var AmbiguityReportSchema = external_exports.object({
  type: external_exports.enum(AMBIGUITY_TYPES),
  description: external_exports.string(),
  options: external_exports.array(external_exports.string()),
  confidence: unitInterval4
});
var AmbiguityFlagSchema = AmbiguityReportSchema.extend({
  severity: external_exports.enum(AMBIGUITY_SEVERITIES)
});
var SourceSpanSchema = external_exports.object({
  start: nonNegativeInt8,
  end: nonNegativeInt8,
  text: external_exports.string()
});
var FormalizationCandidateSchema = external_exports.object({
  candidateId: uuid4,
  narsese: external_exports.string(),
  taskType: TaskTypeSchema,
  truth: TruthValueSchema.optional(),
  confidence: unitInterval4,
  // LLM's confidence in this parse
  sourceSpans: external_exports.array(SourceSpanSchema),
  ambiguityFlags: external_exports.array(AmbiguityFlagSchema),
  metadata: external_exports.object({
    model: external_exports.string().optional(),
    promptTokens: nonNegativeInt8.optional(),
    completionTokens: nonNegativeInt8.optional(),
    latencyMs: nonNegativeInt8.optional()
  }).optional()
});
var DETECTED_INTENTS = ["chat", "command", "reasoning", "learning"];
var DetectedIntentSchema = external_exports.enum(DETECTED_INTENTS);
var FormalizationBatchSchema = external_exports.object({
  batchId: uuid4,
  sourceText: external_exports.string(),
  candidates: external_exports.array(FormalizationCandidateSchema),
  detectedIntent: DetectedIntentSchema.optional(),
  globalAmbiguities: external_exports.array(AmbiguityFlagSchema).optional()
});
var validateFormalizationCandidate = validatorFor6(
  FormalizationCandidateSchema,
  "FormalizationCandidate"
);
var validateFormalizationBatch = validatorFor6(
  FormalizationBatchSchema,
  "FormalizationBatch"
);

// src/schemas/gate-io.ts
import { positiveInt as positiveInt5, signedUnitInterval, unitInterval as unitInterval5, uuid as uuid5 } from "@senars/util/config";
var PerceptionGateInputSchema = external_exports.object({
  sourceId: external_exports.string(),
  /**
   * A4a/X29: explicit provenance; falls back to sourceId heuristics when omitted.
   * Read off the admitted payload's own enum rather than spelled again — the gate
   * passes this through unchanged, so a provenance the gate can accept but the
   * event cannot record is not expressible.
   */
  source: StimulusSourceSchema.optional(),
  rawObservation: external_exports.unknown(),
  sensorConfidence: unitInterval5,
  sourceQuality: SourceQualitySchema,
  correlationId: external_exports.string().optional()
});
var PerceptionGateOutputSchema = external_exports.object({
  admitted: external_exports.boolean(),
  task: TaskAdmittedEventSchema.shape.payload.optional(),
  rejectionReason: external_exports.string().optional()
});
var ActionGateInputSchema = external_exports.object({
  proposalId: uuid5,
  operation: external_exports.string(),
  args: external_exports.record(external_exports.string(), external_exports.unknown()),
  proposerReflexId: external_exports.string().optional(),
  nalDerivationId: uuid5.optional(),
  correlationId: external_exports.string().optional()
});
var ActionGateOutputSchema = external_exports.object({
  authorized: external_exports.boolean(),
  toolCallId: uuid5.optional(),
  vetoReason: external_exports.string().optional(),
  // If NAL derivation vetoes
  requiredApprovals: external_exports.array(external_exports.string()).optional()
});
var RewardGateInputSchema = external_exports.object({
  eventId: uuid5,
  rewardSignal: signedUnitInterval,
  rewardType: external_exports.enum([
    "extrinsic",
    "intrinsic",
    "derivation-depth-reduction",
    "self-model-accuracy",
    "contradiction-reduction"
  ]),
  targetType: external_exports.enum([
    "attention-priority",
    "policy-weights",
    "truth-frequency",
    "truth-confidence"
  ]),
  targetId: external_exports.string(),
  domain: RewardDomainSchema.optional(),
  correlationId: external_exports.string().optional()
});
var RewardGateOutputSchema = external_exports.object({
  accepted: external_exports.boolean(),
  mutationApplied: external_exports.boolean().optional(),
  epistemicFirewallViolation: external_exports.boolean().optional(),
  rejectionReason: external_exports.string().optional(),
  requiresProposal: external_exports.boolean().optional()
});
var BudgetOperationSchema = external_exports.enum([
  "nal-step",
  "lm-call",
  "memory-op",
  "derivation-depth",
  "systemone-judgment",
  "derivation",
  "premise-selection",
  "candidate-derivation",
  "proposal-application",
  "control-work",
  "decision-derivation"
]);
var BUDGET_OPERATIONS = BudgetOperationSchema.options;
var BudgetGateInputSchema = external_exports.object({
  budget: ReasoningBudgetSchema.optional(),
  operation: BudgetOperationSchema,
  estimatedCost: positiveInt5.optional(),
  scopeId: external_exports.union([external_exports.enum(BUDGET_SCOPE_IDS), external_exports.string()]).optional(),
  correlationId: external_exports.string().optional()
});
var BudgetGateOutputSchema = external_exports.object({
  granted: external_exports.boolean(),
  updatedBudget: ReasoningBudgetSchema.optional(),
  terminationReason: TerminationReasonSchema.optional()
});

// src/agent/pipeline.ts
import {
  PushQueue
} from "@senars/util";

// src/motor/toToolSet.ts
import { jsonSchema, tool } from "ai";
function motorToToolSet(motor) {
  const set = {};
  const specs = typeof motor.list === "function" ? motor.list() : [];
  for (const spec of specs) {
    set[spec.name] = tool({
      description: spec.description,
      inputSchema: jsonSchema(spec.parameters),
      execute: async (args) => {
        const result = await motor.execute(spec.name, args ?? {});
        return result.success ? result.content : { error: result.error };
      }
    });
  }
  return set;
}

// src/agent/pipeline.ts
var createMacroContext = (host, stimulus, opts) => ({
  host,
  stimulus,
  opts,
  stream: new PushQueue(),
  state: { derivations: [], narrativeText: "", toolResults: [] }
});
var motorTools = (host) => motorToToolSet(host.motor);

// src/agent/phases.ts
var logger = createLogger({ scope: "agent-phases", level: "warn" });
var EMPTY_CONTEXT = { working: [], episodic: [], semantic: [] };
var reportEgressRejection = (host, correlationId, score) => {
  host.emit(
    mintCognitiveEvent("egress.gate.rejected", {
      engine: NAR_ORIGIN,
      correlationId,
      payload: { gate: "groundedness", score }
    })
  );
};
var inputUser = (stimulus) => ({
  engine: NAR_ORIGIN,
  correlationId: stimulus.correlationId,
  payload: { text: stimulus.text, source: stimulus.source }
});
var perceive = (host, stimulus) => {
  host.emit(mintCognitiveEvent("input.user", inputUser(stimulus)));
};
var recall = async (host, stimulus) => {
  const cid = await host.log.append({ ...inputUser(stimulus), type: "input.user" });
  const working = host.memory.recent(RECALL_WINDOW);
  const episodic = await host.memory.queryEpisodic();
  const semantic = await host.memory.querySemantic(stimulus.text);
  const context = { working, episodic, semantic };
  return { cid, context };
};
var engineFault = (host, hook) => (id, error) => {
  logger.warn(`engine.${hook} failed`, { engine: id, error });
  host.onEngineError?.(id, error);
};
var reason = async (host, stimulus, context) => {
  const derivations = await sweepEngines(
    host.engines,
    (engine) => engine.reason(stimulus, context),
    engineFault(host, "reason")
  );
  return derivations.flat();
};
var verbalizeDerivations = (derivations) => derivations.length > 0 ? `Derivations: ${derivations.map((d) => d.term).join("; ")}` : "No grounded derivations available.";
var narrateStreaming = async (ctx) => {
  const { host, stimulus, state, stream, opts } = ctx;
  const tier = opts?.tier ?? host.narrateTier;
  const cortex = host.cortex;
  if (cortex) {
    const s = typeof cortex.synthesizeStream === "function" ? cortex.synthesizeStream(
      {
        stimulus,
        context: state.context ?? EMPTY_CONTEXT,
        derivations: state.derivations,
        tools: motorTools(host),
        tier
      },
      opts?.signal
    ) : (async function* () {
      const res = await cortex.synthesize({
        stimulus,
        context: state.context ?? EMPTY_CONTEXT,
        derivations: state.derivations,
        tools: motorTools(host),
        tier
      });
      yield { kind: "text-delta", text: res.text };
    })();
    state.narrativeText += await collectText(s, (evt) => stream.push(evt));
    if (!state.narrativeText) state.narrativeText = host.getLastResponse();
    else if (host.groundednessGate) {
      const verdict = egressVerdict(
        await host.groundednessGate(state.narrativeText, stimulus.correlationId)
      );
      state.egress = verdict;
      if (!verdict.grounded) {
        reportEgressRejection(host, stimulus.correlationId, verdict.score);
        stream.push({
          kind: "text-delta",
          text: `[egress gate rejected narration${verdict.score !== void 0 ? ` (score ${verdict.score.toFixed(2)})` : ""} \u2014 falling back to grounded verbalization]`
        });
        state.narrativeText = verbalizeDerivations(state.derivations);
      }
    } else {
      host.memory.append({
        type: "narrative",
        payload: state.narrativeText,
        correlationId: stimulus.correlationId
      });
    }
  } else {
    for (const d of state.derivations) {
      host.memory.append({
        type: "derivation",
        payload: d,
        correlationId: stimulus.correlationId
      });
    }
  }
};
var consolidateMemory = async (ctx) => {
  const { host, stimulus, state } = ctx;
  if (host.episodicMemory && state.narrativeText) {
    await host.episodicMemory.log("response", state.narrativeText, {
      correlationId: stimulus.correlationId
    });
  }
  if (host.episodicMemory && stimulus.source === "chat") {
    await host.episodicMemory.log("input", stimulus.text, {
      correlationId: stimulus.correlationId
    });
  }
};
var act = async (ctx) => {
  const { host, stimulus, state } = ctx;
  const toolResults = [];
  if (host.commandParser && state.narrativeText) {
    const commands = host.commandParser(state.narrativeText);
    for (const cmd of commands) {
      if (cmd.command === "send") {
        host.setLastResponse(cmd.args[0] ?? "");
        continue;
      }
      const policyCheck = host.policy.checkCommand(cmd.command);
      if (!policyCheck.allowed) {
        const result2 = toolError(policyCheck.reason ?? "Blocked by policy");
        toolResults.push({ command: cmd.command, result: result2 });
        continue;
      }
      const toolArgs = {
        args: cmd.args,
        raw: cmd.raw,
        command: cmd.command
      };
      const result = await host.motor.execute(cmd.command, toolArgs, {
        chainId: stimulus.correlationId
      });
      toolResults.push({ command: cmd.command, result });
      await host.log.append({
        engine: NAR_ORIGIN,
        type: "tool.request",
        payload: {
          toolName: cmd.command,
          args: { args: cmd.args },
          timeoutMs: SHELL_TIMEOUT_MS
        },
        correlationId: stimulus.correlationId,
        causationId: state.cid?.id ?? ""
      });
      await sweepEngines(
        host.engines,
        (engine) => engine.absorb?.(result),
        engineFault(host, "absorb")
      );
    }
  }
  return toolResults;
};
var record = async (ctx) => {
  const { host, stimulus, state } = ctx;
  await host.memory.consolidate(state.cid?.id ?? "");
  for (const tr of state.toolResults) {
    host.memory.append({
      type: "tool_result",
      payload: tr,
      correlationId: stimulus.correlationId
    });
  }
  if (host.consolidateLearning && host.consolidation?.enabled !== false) {
    try {
      await host.consolidateLearning({ budget: host.consolidation?.budget });
    } catch {
    }
  }
  if (host.traceGrader && state.narrativeText) {
    try {
      await host.traceGrader({
        narration: state.narrativeText,
        toolCalls: state.toolResults.map((tr) => ({
          command: tr.command,
          success: tr.result.success
        })),
        correlationId: stimulus.correlationId,
        egress: state.egress
      });
    } catch {
    }
  }
};
var announce = (ctx) => {
  const { host, stimulus, state } = ctx;
  for (const d of state.derivations) {
    host.emit(
      mintCognitiveEvent("derivation.made", {
        engine: NAR_ORIGIN,
        correlationId: stimulus.correlationId,
        payload: { rule: "", premises: [], conclusion: d.term }
      })
    );
  }
  for (const tr of state.toolResults) {
    host.emit(
      mintCognitiveEvent("skill.executed", {
        engine: NAR_ORIGIN,
        correlationId: stimulus.correlationId,
        payload: {
          skill: tr.command,
          args: [],
          result: tr.result.success ? "success" : tr.result.error ?? "error",
          durationMs: 0
        }
      })
    );
  }
};
var perceivePhase = async (ctx, next) => {
  perceive(ctx.host, ctx.stimulus);
  await next();
};
var recallPhase = async (ctx, next) => {
  const { cid, context } = await recall(ctx.host, ctx.stimulus);
  ctx.state.cid = cid;
  ctx.state.context = context;
  await next();
};
var reasonPhase = async (ctx, next) => {
  ctx.state.derivations = await reason(ctx.host, ctx.stimulus, ctx.state.context ?? EMPTY_CONTEXT);
  await next();
};
var narratePhase = async (ctx, next) => {
  await narrateStreaming(ctx);
  await next();
};
var consolidatePhase = async (ctx, next) => {
  await consolidateMemory(ctx);
  await next();
};
var actPhase = async (ctx, next) => {
  ctx.state.toolResults = await act(ctx);
  await next();
};
var recordPhase = async (ctx, next) => {
  await record(ctx);
  await next();
};
var announcePhase = async (ctx, next) => {
  announce(ctx);
  await next();
};
var DEFAULT_MACRO_PIPELINE = [
  perceivePhase,
  recallPhase,
  reasonPhase,
  narratePhase,
  consolidatePhase,
  actPhase,
  recordPhase,
  announcePhase
];
var runCycle = async (host, stimulus, phases = host.macroPipeline ?? DEFAULT_MACRO_PIPELINE) => {
  return drain(runCycleStream(host, stimulus, { pipeline: phases }));
};
async function* runCycleStream(host, stimulus, opts) {
  host.setLastResponse("");
  const ctx = createMacroContext(host, stimulus, opts);
  const running = (async () => {
    try {
      await dispatch(opts?.pipeline ?? host.macroPipeline ?? DEFAULT_MACRO_PIPELINE, ctx);
    } finally {
      ctx.stream.close();
    }
  })();
  yield* ctx.stream;
  await running;
  return host.getLastResponse() || ctx.state.narrativeText;
}

// src/eventlog/InMemoryEventLog.ts
import { getOrInsert } from "@senars/util";

// src/eventlog/AbstractEventLog.ts
import { sortableIdSource } from "@senars/util";
import { PushQueue as PushQueue2 } from "@senars/util/events";

// src/eventlog/EventLog.ts
import { SenarsError } from "@senars/util";
var EventLogError = class extends SenarsError {
  constructor(code, message, cause) {
    super(message, code, void 0, { cause });
    this.name = "EventLogError";
  }
};
var typeSetOf = (types) => types?.length ? new Set(types) : void 0;
var subscriptionAdmits = ({ types, filter }, event) => (types === void 0 || types.has(event.type)) && (filter === void 0 || filter(event));

// src/eventlog/AbstractEventLog.ts
var DEFAULT_LIMITS = { maxEvents: 1e5, maxEventSize: 1024 * 1024 };
var _subscribers, _closed, _ids;
var AbstractEventLog = class {
  constructor(limits = {}) {
    __privateAdd(this, _subscribers, /* @__PURE__ */ new Set());
    __privateAdd(this, _closed, false);
    __privateAdd(this, _ids, sortableIdSource());
    __publicField(this, "limits");
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }
  /** The one closed-log refusal. `append` and every `doAppend` reach it through here. */
  assertOpen() {
    if (__privateGet(this, _closed)) throw new EventLogError("UNAVAILABLE", "Event log is closed");
  }
  /**
   * Shared append preconditions: closed log, oversized event, or full store.
   *
   * `payloadJson` is the serialization this append already performed, so the size
   * guard costs no second pass over the event and reports the number the durable
   * log stores. The envelope around a payload — a UUID id, a type name, two
   * integers — is bounded by construction and by `maxEvents`, so the payload is
   * what a size limit can actually be exceeded by.
   */
  assertAppendable(payloadJson, isFull) {
    this.assertOpen();
    const eventSize = payloadJson.length;
    if (eventSize > this.limits.maxEventSize) {
      throw new EventLogError(
        "INVALID_EVENT",
        `Event size ${eventSize} exceeds max ${this.limits.maxEventSize}`
      );
    }
    if (isFull) {
      throw new EventLogError("FULL", `Event log full (${this.limits.maxEvents} events)`);
    }
  }
  markClosed() {
    __privateSet(this, _closed, true);
  }
  async close() {
    this.markClosed();
    for (const sub of __privateGet(this, _subscribers)) sub.queue.close();
    __privateGet(this, _subscribers).clear();
  }
  /**
   * Append-order key. Monotonic and lexicographically sortable, because both
   * logs range-scan on it (`ORDER BY id`, `getRange`) — one source, shared by
   * both, so the sqlite and in-memory logs order identically.
   */
  generateId() {
    return __privateGet(this, _ids).call(this);
  }
  async append(event) {
    this.assertOpen();
    const full = validateCognitiveEvent({
      ...event,
      id: this.generateId(),
      timestamp: Date.now()
    });
    await this.doAppend(full, JSON.stringify(full.payload));
    this.notify(full);
    return full;
  }
  subscribe(options) {
    const queue = new PushQueue2();
    const subscription = {
      filter: options?.filter,
      fromId: options?.fromId,
      types: typeSetOf(options?.types),
      queue
    };
    queue.onClose = () => __privateGet(this, _subscribers).delete(subscription);
    __privateGet(this, _subscribers).add(subscription);
    if (options?.fromId) {
      this.getRange(options.fromId).then((events) => {
        for (const event of events) {
          if (subscriptionAdmits(subscription, event)) subscription.queue.push(event);
        }
      });
    }
    return subscription.queue;
  }
  notify(event) {
    for (const sub of __privateGet(this, _subscribers)) {
      if (sub.queue.closed) continue;
      try {
        if (sub.fromId && sub.fromId >= (event.id ?? "")) continue;
        if (!subscriptionAdmits(sub, event)) continue;
        sub.queue.push(event);
      } catch {
      }
    }
  }
};
_subscribers = new WeakMap();
_closed = new WeakMap();
_ids = new WeakMap();

// src/eventlog/InMemoryEventLog.ts
var _events, _snapshots;
var InMemoryEventLog = class extends AbstractEventLog {
  constructor(config = {}) {
    super(config);
    __privateAdd(this, _events, []);
    __privateAdd(this, _snapshots, /* @__PURE__ */ new Map());
  }
  getSnapshot(projectionName, version) {
    return Promise.resolve(__privateGet(this, _snapshots).get(projectionName)?.get(version) ?? null);
  }
  saveSnapshot(projectionName, version, data) {
    getOrInsert(__privateGet(this, _snapshots), projectionName, () => /* @__PURE__ */ new Map()).set(version, data);
    return Promise.resolve();
  }
  get size() {
    return __privateGet(this, _events).length;
  }
  get events() {
    return __privateGet(this, _events);
  }
  async query(query) {
    const types = typeSetOf(query.types);
    const { correlationId, timeRange, limit } = query;
    const { events } = this;
    const matches = [];
    for (let i = events.length - 1; i >= 0 && (limit === void 0 || matches.length < limit); i--) {
      const e = events[i];
      if (correlationId && e.correlationId !== correlationId) continue;
      if (types && !types.has(e.type)) continue;
      if (timeRange && (e.timestamp < timeRange[0] || e.timestamp > timeRange[1])) continue;
      matches.push(e);
    }
    return matches.reverse();
  }
  async getRange(fromId, toId) {
    const startIdx = __privateGet(this, _events).findIndex((e) => (e.id ?? "") > fromId);
    if (startIdx < 0) return [];
    let endIdx = __privateGet(this, _events).length;
    if (toId) {
      const foundIdx = __privateGet(this, _events).findIndex((e) => (e.id ?? "") > toId);
      if (foundIdx >= 0) endIdx = foundIdx;
    }
    return __privateGet(this, _events).slice(startIdx, endIdx);
  }
  async doAppend(fullEvent, payloadJson) {
    this.assertAppendable(payloadJson, __privateGet(this, _events).length >= this.limits.maxEvents);
    __privateGet(this, _events).push(fullEvent);
  }
};
_events = new WeakMap();
_snapshots = new WeakMap();

// src/memory/MemoryService.ts
import { BoundedRing, generateId as generateId2, takeLast } from "@senars/util";
var _working, _log, _engines, _motor, _tiers;
var MemoryService = class {
  constructor() {
    /**
     * The working tier is a bounded ring, like every other bounded structure in the
     * kernel, so it reports `pressure()` and evicts by the same rule rather than by
     * a bare `pushCapped` against a private `#maxWorking`.
     */
    __privateAdd(this, _working, new BoundedRing(WORKING_MEMORY_CAPACITY));
    __privateAdd(this, _log);
    __privateAdd(this, _engines);
    __privateAdd(this, _motor);
    __privateAdd(this, _tiers, /* @__PURE__ */ new Map());
  }
  get size() {
    return __privateGet(this, _working).size();
  }
  get all() {
    return __privateGet(this, _working).toArray();
  }
  /** Occupancy of the working tier, `0..1` — the AIKR pressure signal. */
  pressure() {
    return __privateGet(this, _working).pressure();
  }
  get connectedEngines() {
    return __privateGet(this, _engines);
  }
  /** Resize the working tier, keeping the most recent entries that still fit. */
  setMaxWorking(max) {
    const kept = __privateGet(this, _working).tail(max);
    __privateSet(this, _working, new BoundedRing(Math.max(1, max)));
    for (const entry of kept) __privateGet(this, _working).push(entry);
  }
  /** Connect the EventLog for Tier 1 (episodic) queries */
  connectLog(log) {
    __privateSet(this, _log, log);
  }
  /** Connect engines for Tier 2 (semantic) queries */
  connectEngines(engines) {
    __privateSet(this, _engines, engines);
  }
  /** Connect ToolRegistry for Tier 3 (procedural) feedback */
  connectMotor(motor) {
    __privateSet(this, _motor, motor);
  }
  append(entry) {
    const full = {
      ...entry,
      id: generateId2("mem"),
      timestamp: Date.now()
    };
    __privateGet(this, _working).push(full);
  }
  recent(limit, type) {
    return type ? takeLast(
      __privateGet(this, _working).filter((e) => e.type === type),
      limit
    ) : __privateGet(this, _working).tail(limit);
  }
  query(q) {
    const { type, from, to, limit } = q;
    const inRange = (e) => (!type || e.type === type) && (from === void 0 || e.timestamp >= from) && (to === void 0 || e.timestamp <= to);
    const matched = __privateGet(this, _working).filter(inRange);
    return takeLast(matched, limit ?? matched.length);
  }
  queryTimeRange(from, to) {
    return __privateGet(this, _working).filter((e) => e.timestamp >= from && e.timestamp <= to);
  }
  queryAroundTime(ts, windowMs) {
    return __privateGet(this, _working).filter((e) => Math.abs(e.timestamp - ts) <= windowMs);
  }
  /** Tier 1: Episodic memory via the log's own filtered read. */
  async queryEpisodic(from, to, types, limit = RECALL_WINDOW) {
    if (!__privateGet(this, _log)) return [];
    try {
      const events = await __privateGet(this, _log).query({
        types,
        timeRange: from === void 0 && to === void 0 ? void 0 : [from ?? 0, to ?? Number.MAX_SAFE_INTEGER],
        limit
      });
      return events.map((e) => ({
        id: e.id ?? `event-${e.timestamp}`,
        type: e.type,
        payload: e.payload,
        timestamp: e.timestamp,
        correlationId: e.correlationId
      }));
    } catch {
      return [];
    }
  }
  /** Tier 2: Semantic memory via engines */
  async querySemantic(pattern) {
    const results = await sweepEngines(__privateGet(this, _engines), (engine) => engine.query(pattern));
    return results.flat();
  }
  /** Tier 3: Procedural memory — tool feedback */
  getProceduralFeedback() {
    return __privateGet(this, _motor)?.getAllFeedback() ?? [];
  }
  /** Tier 4: Long-term persistence */
  async persist() {
    await sweepEngines(__privateGet(this, _engines), (engine) => engine.persist?.());
  }
  async load() {
    await sweepEngines(__privateGet(this, _engines), (engine) => engine.load?.());
  }
  /** Register an additional memory tier (e.g. vector store via plugin). */
  addTier(name, impl) {
    __privateGet(this, _tiers).set(name, impl);
  }
  getTier(name) {
    return __privateGet(this, _tiers).get(name);
  }
  /** Consolidate: promote high-salience entries to semantic via engines */
  async consolidate(_correlationId) {
  }
  clear() {
    __privateGet(this, _working).clear();
  }
};
_working = new WeakMap();
_log = new WeakMap();
_engines = new WeakMap();
_motor = new WeakMap();
_tiers = new WeakMap();

// src/motor/builtin-tools.ts
import { exec } from "child_process";
import { access, appendFile, readFile, writeFile } from "fs/promises";
import { promisify } from "util";
import {
  CAPABILITY_RISKS,
  CapabilityRiskSchema as CapabilityRiskSchema2,
  envStr,
  errMsg as errMsg4,
  objectSpec,
  toolAttempt,
  toolError as toolError2,
  toolOk
} from "@senars/util";

// src/motor/web-search.ts
import { boundedFetch, collectUpTo, errMsg as errMsg3, readBodyBounded, splitLines } from "@senars/util";
import { envFirst } from "@senars/util/config";
var MAX_BODY_BYTES = 512 * 1024;
var MAX_FETCH_CHARS = MAX_BODY_BYTES / 2;
var fetchBounded = (url, init) => boundedFetch(url, init, { timeoutMs: WEB_FETCH_TIMEOUT_MS });
var readBody = (res) => readBodyBounded(res, MAX_BODY_BYTES);
var decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ");
var stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, "")).trim();
var htmlToText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
var collapseBlankLines = (s) => splitLines(s).join("\n");
var tavilySearch = async (query, apiKey, maxResults = 5) => {
  const res = await fetchBounded("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic" })
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).filter((r) => r.url).map((r) => ({ title: r.title ?? "", url: r.url, snippet: r.content }));
};
var braveSearch = async (query, apiKey, maxResults = 5) => {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  const res = await fetchBounded(url.toString(), {
    headers: { accept: "application/json", "x-subscription-token": apiKey }
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const data = await res.json();
  return (data.web?.results ?? []).filter((r) => r.url).map((r) => ({ title: r.title ?? "", url: r.url, snippet: r.description }));
};
var resolveDDGHref = (raw) => {
  const uddg = /uddg=([^&]+)/.exec(raw)?.[1];
  return uddg ? decodeURIComponent(uddg) : raw.startsWith("http") ? raw : void 0;
};
var duckDuckGoSearch = async (query, maxResults = 5) => {
  const res = await fetchBounded(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "user-agent": "Mozilla/5.0 (SeNARS web-fetch; +https://github.com/senars)" } }
  );
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
  const html = await readBody(res);
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [...html.matchAll(snippetRe)].map((m) => stripTags(m[1] ?? ""));
  let admitted = 0;
  return collectUpTo(html.matchAll(linkRe), maxResults, (m) => {
    const [, href, titleHtml] = m;
    if (!href || !titleHtml) return void 0;
    const url = resolveDDGHref(decodeEntities(href));
    if (!url) return void 0;
    const snippet = snippets[admitted++];
    return { title: stripTags(titleHtml).trim(), url, ...snippet ? { snippet } : {} };
  });
};
var SEARCH_PROVIDERS = [
  {
    name: "tavily",
    configured: () => envFirst("TAVILY_API_KEY") !== void 0,
    search: (query, maxResults) => tavilySearch(query, envFirst("TAVILY_API_KEY"), maxResults)
  },
  {
    name: "brave",
    configured: () => braveApiKey() !== void 0,
    search: (query, maxResults) => braveSearch(query, braveApiKey(), maxResults)
  },
  { name: "duckduckgo", configured: () => true, search: duckDuckGoSearch }
];
function braveApiKey() {
  return envFirst("BRAVE_API_KEY") ?? envFirst("WEB_SEARCH_API_KEY");
}
async function searchWeb(query, maxResults = 5, providers = SEARCH_PROVIDERS) {
  const configured = providers.filter((p) => p.configured());
  if (configured.length === 0)
    return { query, via: "none", results: [], note: "no provider configured" };
  const failures = [];
  for (const provider of configured) {
    try {
      return { query, via: provider.name, results: await provider.search(query, maxResults) };
    } catch (e) {
      failures.push(`${provider.name}: ${errMsg3(e)}`);
    }
  }
  return { query, via: "none", results: [], note: `all providers failed (${failures.join("; ")})` };
}
var webFetch = async (url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`web-fetch refuses non-http protocol: ${parsed.protocol}`);
  }
  const res = await fetchBounded(parsed, {
    headers: { accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" },
    redirect: "follow"
  });
  const finalUrl = new URL(res.url);
  if (finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") {
    throw new Error(`web-fetch refuses non-http redirect target: ${finalUrl.protocol}`);
  }
  if (!res.ok) throw new Error(`web-fetch ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "text/plain";
  const body = await readBody(res);
  const text = contentType.includes("html") ? stripTags(collapseBlankLines(htmlToText(body))) : body;
  return { url: res.url, status: res.status, contentType, text: text.slice(0, MAX_FETCH_CHARS) };
};

// src/motor/workspace.ts
import path from "path";
import { containsPath } from "@senars/util";
var WORKSPACE_ROOT = process.cwd();
var withinWorkspace = (p) => containsPath(WORKSPACE_ROOT, path.resolve(p));

// src/motor/builtin-tools.ts
var ARGS_SCHEMA = objectSpec({ args: { type: "array", items: { type: "string" } } });
var cmdArgs = (args) => args.args ?? [];
var argAt = (args, index) => cmdArgs(args)[index];
var textAt = (args, index) => {
  const raw = argAt(args, index);
  return raw === void 0 ? void 0 : parseJsonArg(raw);
};
var missing = (tool2, what) => toolError2(`${tool2} requires ${what}`);
var defineCmd = (name, description, execute) => ({ name, description, parameters: ARGS_SCHEMA, execute: async (a) => execute(a) });
function parseJsonArg(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}
async function keyedProvider(rawQuery, via, apiKey, run) {
  const query = parseJsonArg(rawQuery);
  if (!apiKey) return toolOk({ query, results: [], note: `${via.toUpperCase()}_API_KEY not set` });
  return toolAttempt(
    `${via}_search failed`,
    () => run(query, apiKey),
    (results) => ({ query, via, results })
  );
}
function createRequestApprovalTool(approvalService) {
  const schema = external_exports.object({
    actionDescription: external_exports.string().describe("Description of the action requiring approval"),
    diffOrPayload: external_exports.string().describe("The diff, payload, or details of the action"),
    riskLevel: CapabilityRiskSchema2.describe("Risk level of the action"),
    timeoutMs: external_exports.number().optional().default(APPROVAL_TIMEOUT_MS).describe("Timeout in milliseconds")
  });
  return {
    name: "request_approval",
    description: "Requests human approval for critical actions (code write, config change, destructive command). Blocks until approved/rejected.",
    parameters: objectSpec(
      {
        actionDescription: { type: "string" },
        diffOrPayload: { type: "string" },
        riskLevel: { type: "string", enum: [...CAPABILITY_RISKS] },
        timeoutMs: { type: "number", default: APPROVAL_TIMEOUT_MS }
      },
      "actionDescription",
      "diffOrPayload",
      "riskLevel"
    ),
    execute: async (args) => {
      try {
        const parsed = schema.parse(args);
        const result = await approvalService.requestApproval({
          action: parsed.actionDescription,
          payload: parsed.diffOrPayload,
          risk: parsed.riskLevel,
          timeoutMs: parsed.timeoutMs
        });
        return toolOk({
          success: result.approved,
          approved: result.approved,
          feedback: result.feedback
        });
      } catch (err) {
        return toolError2(`Approval error: ${errMsg4(err)}`);
      }
    }
  };
}
var within = (filename) => withinWorkspace(filename) ? null : toolError2(`Path outside workspace rejected: ${filename}`);
var runShell = promisify(exec);
var persistFile = async (tool2, target, content) => {
  const sandbox = within(target);
  if (sandbox) return sandbox;
  const verb = tool2 === "write_file" ? "write" : "append to";
  const key = tool2 === "write_file" ? "written" : "appended";
  return toolAttempt(
    `Cannot ${verb} file`,
    async () => {
      if (tool2 === "write_file") await writeFile(target, content, "utf-8");
      else await appendFile(target, content, "utf-8");
    },
    () => ({ filename: target, [key]: content.length })
  );
};
var requireEpisodic = (deps) => deps.episodic ? null : toolError2("episodic memory not configured");
var createBuiltinTools = (deps = {}) => [
  defineCmd("send", "Send a text response to the user", (args) => {
    const text = textAt(args, 0);
    return text ? toolOk({ text }) : missing("send", "text");
  }),
  defineCmd("remember", "Store something in episodic memory", async (args) => {
    const content = textAt(args, 0);
    if (!content) return missing("remember", "content");
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    await deps.episodic.log("input", content, { via: "remember" });
    return toolOk({ stored: true, content });
  }),
  defineCmd("query", "Query episodic memory", async (args) => {
    const query = textAt(args, 0);
    if (!query) return missing("query", "a search term");
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    return toolOk({ query, episodes: await deps.episodic.search(query, 10) });
  }),
  defineCmd("episodes", "List recent episodic memories", async (args) => {
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    const limit = Number.parseInt(textAt(args, 0) ?? "10", 10);
    return toolOk({ episodes: await deps.episodic.getRecent(limit), limit });
  }),
  defineCmd("read_file", "Read a file from the filesystem", async (args) => {
    const filename = textAt(args, 0);
    if (!filename) return missing("read_file", "a filename");
    const sandbox = within(filename);
    if (sandbox) return sandbox;
    return toolAttempt("Cannot read file", async () => {
      await access(filename);
      const content = await readFile(filename, "utf-8");
      return { filename, size: content.length, content };
    });
  }),
  defineCmd("write_file", "Write content to a file", (args) => {
    const filename = argAt(args, 0);
    const content = argAt(args, 1);
    if (!filename || !content) return missing("write_file", "filename and content");
    return persistFile("write_file", parseJsonArg(filename), content);
  }),
  defineCmd("append_file", "Append content to a file", (args) => {
    const filename = argAt(args, 0);
    const content = argAt(args, 1);
    if (!filename || !content) return missing("append_file", "filename and content");
    return persistFile("append_file", parseJsonArg(filename), content);
  }),
  defineCmd(
    "search",
    "Search the web (Tavily, then Brave, then DuckDuckGo \u2014 whichever is configured)",
    async (args) => {
      const query = textAt(args, 0);
      if (!query) return missing("search", "a query");
      return toolOk(await searchWeb(query));
    }
  ),
  defineCmd("shell", "Execute a shell command", async (args) => {
    const cmd = textAt(args, 0);
    if (!cmd) return missing("shell", "a command");
    try {
      const { stdout } = await runShell(cmd, {
        encoding: "utf-8",
        timeout: SHELL_TIMEOUT_MS
      });
      return toolOk({ command: cmd, exitCode: 0, stdout: stdout.trimEnd() });
    } catch (e) {
      const err = e;
      return toolOk({
        command: cmd,
        exitCode: err.killed ? 124 : -1,
        stdout: (err.stdout ?? "").trimEnd(),
        stderr: (err.stderr ?? "").trimEnd() || (err.killed ? "Command timed out" : "")
      });
    }
  }),
  defineCmd("metta", "Evaluate a MeTTa expression", async (args) => {
    const expression = textAt(args, 0);
    if (!expression) return missing("metta", "an expression");
    if (!deps.metta) return toolError2("metta engine not configured");
    return toolOk({ expression, result: await deps.metta(expression) });
  }),
  defineCmd(
    "pin",
    "Pin a value for retention: `pin <key> <value>` stores; `pin <key>` unpins; `pin --list` lists",
    (args) => {
      if (!deps.pins) return toolError2("pin store not configured");
      const first = textAt(args, 0);
      if (!first || first === "--list") {
        const entries = [...deps.pins.recallAll().entries()].map(([key, value]) => ({
          key,
          value
        }));
        return toolOk({ pinned: entries });
      }
      const second = textAt(args, 1);
      if (second === void 0) {
        deps.pins.unpin(first);
        return toolOk({ unpinned: first });
      }
      deps.pins.pin(first, second);
      return toolOk({ pinned: first, value: second });
    }
  ),
  defineCmd("tavily_search", "Search the web via Tavily API (requires TAVILY_API_KEY)", (args) => {
    const first = argAt(args, 0);
    if (!first) return missing("tavily_search", "a query");
    return keyedProvider(first, "tavily", envStr("TAVILY_API_KEY"), tavilySearch);
  }),
  defineCmd(
    "brave_search",
    "Search the web via Brave Search API (requires BRAVE_API_KEY)",
    (args) => {
      const first = argAt(args, 0);
      if (!first) return missing("brave_search", "a query");
      return keyedProvider(first, "brave", braveApiKey(), braveSearch);
    }
  ),
  defineCmd("web_fetch", "Fetch a web page read-only and return its text content", async (args) => {
    const url = textAt(args, 0);
    if (!url) return missing("web_fetch", "a URL");
    return toolAttempt("Cannot fetch URL", () => webFetch(url));
  })
];
var BUILTIN_TOOLS = createBuiltinTools();
function registerBuiltinTools(registry, approvalService, deps) {
  for (const tool2 of createBuiltinTools(deps ?? {})) {
    registry.register(tool2);
  }
  if (approvalService) {
    registry.register(createRequestApprovalTool(approvalService));
  }
}

// src/motor/ToolRegistry.ts
import {
  stopwatch,
  toolError as toolError3,
  toSkillFeedback
} from "@senars/util";
import { DefaultToolFeedbackObserver } from "@senars/util/feedback";
var _tools, _feedbackObserver, _delegate, _local, _ToolRegistry_instances, localDelegate_fn;
var ToolRegistry = class {
  constructor(feedbackObserver, delegate) {
    __privateAdd(this, _ToolRegistry_instances);
    __privateAdd(this, _tools, /* @__PURE__ */ new Map());
    __privateAdd(this, _feedbackObserver);
    __privateAdd(this, _delegate);
    __privateAdd(this, _local);
    __privateSet(this, _feedbackObserver, feedbackObserver ?? new DefaultToolFeedbackObserver());
    __privateSet(this, _delegate, delegate);
  }
  /** Set the delegate registry (e.g., nar's ToolManager) after construction. */
  setDelegate(delegate) {
    __privateSet(this, _delegate, delegate);
    for (const spec of __privateGet(this, _tools).values()) {
      if (!delegate.get(spec.name)) {
        delegate.register(spec);
      }
    }
    __privateGet(this, _tools).clear();
  }
  target() {
    return __privateGet(this, _delegate) ?? __privateMethod(this, _ToolRegistry_instances, localDelegate_fn).call(this);
  }
  register(spec) {
    this.target().register(spec);
  }
  unregister(name) {
    this.target().unregister(name);
  }
  get(name) {
    return this.target().get(name);
  }
  list() {
    return this.target().list();
  }
  async execute(name, args, context) {
    if (context?.signal?.aborted) {
      return toolError3("Execution aborted");
    }
    return this.target().execute(name, args, context);
  }
  async executeLocal(name, args, context) {
    const tool2 = __privateGet(this, _tools).get(name);
    if (!tool2) return toolError3(`Unknown tool: ${name}`);
    const elapsed = stopwatch();
    try {
      const result = await tool2.execute(args, context);
      __privateGet(this, _feedbackObserver).recordCall(name, result, elapsed());
      return result;
    } catch (err) {
      const result = toolError3(err);
      __privateGet(this, _feedbackObserver).recordCall(name, result, elapsed());
      return result;
    }
  }
  getFeedback(name) {
    return this.target().getFeedback(name);
  }
  getAllFeedback() {
    return this.target().getAllFeedback();
  }
  getRecentResults(limit) {
    return this.target().getRecentResults(limit);
  }
  clear() {
    this.target().clear();
  }
};
_tools = new WeakMap();
_feedbackObserver = new WeakMap();
_delegate = new WeakMap();
_local = new WeakMap();
_ToolRegistry_instances = new WeakSet();
/**
 * This registry as its own delegate, built once. `target()` used to rebuild the
 * whole nine-method object — nine closures over `this` — on every call, and
 * `target()` sits on the per-tool-invocation path.
 */
localDelegate_fn = function() {
  __privateGet(this, _local) ?? __privateSet(this, _local, {
    register: (spec) => void __privateGet(this, _tools).set(spec.name, spec),
    unregister: (name) => void __privateGet(this, _tools).delete(name),
    get: (name) => __privateGet(this, _tools).get(name),
    list: () => [...__privateGet(this, _tools).values()],
    execute: (name, args, context) => this.executeLocal(name, args, context),
    getFeedback: (name) => {
      const fb = __privateGet(this, _feedbackObserver).getFeedback(name);
      return fb ? toSkillFeedback(fb) : void 0;
    },
    getAllFeedback: () => __privateGet(this, _feedbackObserver).getAllFeedback().map(toSkillFeedback),
    getRecentResults: (limit) => __privateGet(this, _feedbackObserver).getFeedbackString(limit),
    clear: () => {
      __privateGet(this, _tools).clear();
      __privateGet(this, _feedbackObserver).resetFeedback();
    }
  });
  return __privateGet(this, _local);
};

// src/PolicyEngine.ts
import path2 from "path";
import { containsPath as containsPath2 } from "@senars/util";
var DEFAULT_POLICY = {
  allowCommands: ["send", "remember", "query", "episodes"],
  denyCommands: ["shell"],
  allowFiles: [],
  denyFiles: [],
  allowShell: false,
  maxFileSize: 1024 * 1024,
  sandboxDir: "./sandbox"
};
var _policy;
var PolicyEngine = class {
  constructor(policy = {}) {
    __privateAdd(this, _policy);
    __privateSet(this, _policy, { ...DEFAULT_POLICY, ...policy });
  }
  checkCommand(command) {
    if (__privateGet(this, _policy).denyCommands?.includes(command)) {
      return { allowed: false, reason: `Command "${command}" is denied by policy` };
    }
    if (__privateGet(this, _policy).allowCommands && __privateGet(this, _policy).allowCommands.length > 0) {
      if (!__privateGet(this, _policy).allowCommands.includes(command)) {
        return { allowed: false, reason: `Command "${command}" is not in allowlist` };
      }
    }
    return { allowed: true };
  }
  checkFileAccess(filepath) {
    const sandbox = __privateGet(this, _policy).sandboxDir;
    if (sandbox && !containsPath2(path2.resolve(sandbox), path2.resolve(filepath))) {
      return { allowed: false, reason: `File "${filepath}" is outside sandbox "${sandbox}"` };
    }
    if (__privateGet(this, _policy).denyFiles?.some((d) => filepath.includes(d))) {
      return { allowed: false, reason: `File "${filepath}" matches deny pattern` };
    }
    return { allowed: true };
  }
  checkShell() {
    if (!__privateGet(this, _policy).allowShell) {
      return { allowed: false, reason: "Shell execution is disabled by policy" };
    }
    return { allowed: true };
  }
  updatePolicy(patch) {
    __privateSet(this, _policy, { ...__privateGet(this, _policy), ...patch });
  }
  getPolicy() {
    return __privateGet(this, _policy);
  }
};
_policy = new WeakMap();

// src/Agent.ts
var _cognitive, _transports, _transportHandlers, _skills, _commandParser, _groundednessGate, _traceGrader, _narrateTier, _macroPipeline, _consolidateLearning, _consolidation, _started, _cycleCount, _engineErrors, _engineErrorCount, _lastCycleTime, _lastResponse, _host, _Agent_instances, cycleHost_fn, emitCognitive_fn;
var Agent = class {
  constructor(opts = {}) {
    __privateAdd(this, _Agent_instances);
    __publicField(this, "id");
    __publicField(this, "log");
    __publicField(this, "memory");
    __publicField(this, "engines", /* @__PURE__ */ new Map());
    __publicField(this, "policy");
    __publicField(this, "motor");
    __publicField(this, "approval");
    __publicField(this, "cortex");
    __publicField(this, "episodicMemory");
    __publicField(this, "sessionManager");
    __publicField(this, "threadScope");
    __privateAdd(this, _cognitive, new Signal());
    __privateAdd(this, _transports, /* @__PURE__ */ new Map());
    __privateAdd(this, _transportHandlers, /* @__PURE__ */ new Map());
    __privateAdd(this, _skills, /* @__PURE__ */ new Map());
    __privateAdd(this, _commandParser);
    __privateAdd(this, _groundednessGate);
    __privateAdd(this, _traceGrader);
    __privateAdd(this, _narrateTier);
    __privateAdd(this, _macroPipeline);
    __privateAdd(this, _consolidateLearning);
    __privateAdd(this, _consolidation);
    __privateAdd(this, _started, false);
    __privateAdd(this, _cycleCount, 0);
    __privateAdd(this, _engineErrors, /* @__PURE__ */ new Map());
    __privateAdd(this, _engineErrorCount, 0);
    __privateAdd(this, _lastCycleTime, 0);
    __privateAdd(this, _lastResponse, "");
    __privateAdd(this, _host);
    this.id = opts.id ?? generateId3("agent");
    this.log = opts.log ?? new InMemoryEventLog();
    this.memory = new MemoryService();
    this.policy = new PolicyEngine();
    this.motor = new ToolRegistry(opts.feedbackObserver);
    this.cortex = opts.cortex;
    this.episodicMemory = opts.episodicMemory;
    this.sessionManager = opts.sessionManager;
    __privateSet(this, _commandParser, opts.commandParser);
    __privateSet(this, _groundednessGate, opts.groundednessGate);
    __privateSet(this, _traceGrader, opts.traceGrader);
    __privateSet(this, _narrateTier, opts.narrateTier);
    __privateSet(this, _macroPipeline, opts.macroPipeline);
    __privateSet(this, _consolidateLearning, opts.consolidateLearning);
    __privateSet(this, _consolidation, opts.consolidation);
    this.threadScope = opts.threadScope;
    this.memory.connectLog(this.log);
    this.memory.connectEngines(this.engines);
    this.memory.connectMotor(this.motor);
    const approvalService = new ApprovalService();
    this.approval = approvalService;
    if (opts.builtinTools !== false) {
      registerBuiltinTools(this.motor, approvalService, {
        episodic: this.episodicMemory,
        metta: opts.mettaExecutor,
        pins: opts.pinStore
      });
    }
  }
  registerEngine(id, engine) {
    this.engines.set(id, engine);
    this.memory.connectEngines(this.engines);
  }
  async cycle(stimulus) {
    __privateWrapper(this, _cycleCount)._++;
    __privateSet(this, _lastCycleTime, Date.now());
    return runCycle(__privateMethod(this, _Agent_instances, cycleHost_fn).call(this), stimulus);
  }
  submit(input, correlationId) {
    __privateMethod(this, _Agent_instances, emitCognitive_fn).call(this, mintCognitiveEvent("input.user", {
      engine: NAR_ORIGIN,
      correlationId,
      payload: { text: input, source: "transport" }
    }));
  }
  mount(transport) {
    const handler = async (message) => {
      const correlationId = makeId2();
      this.submit(message.text, correlationId);
    };
    transport.onMessage(handler);
    __privateGet(this, _transportHandlers).set(transport.id, handler);
    __privateGet(this, _transports).set(transport.id, transport);
  }
  unmount(idOrTransport) {
    const id = typeof idOrTransport === "string" ? idOrTransport : idOrTransport.id;
    const transport = __privateGet(this, _transports).get(id);
    if (!transport) return;
    const handler = __privateGet(this, _transportHandlers).get(id);
    if (handler) {
      transport.removeMessageHandler(handler);
      __privateGet(this, _transportHandlers).delete(id);
    }
    __privateGet(this, _transports).delete(id);
  }
  on(_event, handler) {
    return __privateGet(this, _cognitive).on(handler);
  }
  off(_event, handler) {
    __privateGet(this, _cognitive).off(handler);
  }
  emitCognitive(event) {
    __privateMethod(this, _Agent_instances, emitCognitive_fn).call(this, event);
  }
  registerSkill(name, def) {
    __privateGet(this, _skills).set(name, { name, ...def });
  }
  capabilities() {
    return {
      engine: "nar",
      supports: {
        chat: true,
        beliefs: true,
        drives: false,
        skills: true,
        ltm: true,
        rlfp: false,
        selfReasoning: false,
        autonomyLoop: false
      }
    };
  }
  health() {
    const byEngine = mapToRecord(__privateGet(this, _engineErrors));
    return {
      status: __privateGet(this, _started) ? "healthy" : "stuck",
      lastCycle: __privateGet(this, _lastCycleTime),
      cycleCount: __privateGet(this, _cycleCount),
      errorRate: __privateGet(this, _cycleCount) ? __privateGet(this, _engineErrorCount) / __privateGet(this, _cycleCount) : 0,
      byEngine
    };
  }
  /** Per-engine fault tally for `health()`; a cycle with no faults reports zero. */
  onEngineError(engineId) {
    __privateWrapper(this, _engineErrorCount)._++;
    incrementCount(__privateGet(this, _engineErrors), engineId);
  }
  async start() {
    if (__privateGet(this, _started)) return;
    __privateSet(this, _started, true);
    await sweepEngines(this.engines, (engine) => invokeEngineHook(engine, "initialize"));
    await this.memory.load();
    await this.sessionManager?.restore();
  }
  async stop() {
    if (!__privateGet(this, _started)) return;
    __privateSet(this, _started, false);
    await this.sessionManager?.snapshot();
    await this.memory.persist();
    for (const [id, transport] of __privateGet(this, _transports)) {
      this.unmount(id);
      await transport.disconnect("agent stopping");
    }
    await sweepEngines(this.engines, (engine) => invokeEngineHook(engine, "shutdown"));
  }
  async *chat(input, opts) {
    const correlationId = makeId2();
    const stimulus = {
      text: input,
      source: "chat",
      timestamp: Date.now(),
      correlationId
    };
    if (opts?.signal?.aborted) {
      yield { kind: "aborted" };
      return "";
    }
    let finalText = "";
    for await (const evt of runCycleStream(__privateMethod(this, _Agent_instances, cycleHost_fn).call(this), stimulus, opts)) {
      yield evt;
      finalText = appendTextDelta(finalText, evt);
    }
    if (!finalText) {
      finalText = `[agent] ${input}`;
      yield { kind: "text-delta", text: finalText };
    }
    yield { kind: "finish", text: finalText };
    return finalText;
  }
  getRecentDerivations() {
    return this.memory.recent(RECALL_WINDOW).filter((e) => e.type === "derivation").map((e) => e.payload);
  }
  /** Phase A (REFACTOR.todo1): install a custom macro pipeline (e.g. dialogue Capture phase). */
  setMacroPipeline(phases) {
    __privateSet(this, _macroPipeline, phases);
    __privateSet(this, _host, void 0);
  }
};
_cognitive = new WeakMap();
_transports = new WeakMap();
_transportHandlers = new WeakMap();
_skills = new WeakMap();
_commandParser = new WeakMap();
_groundednessGate = new WeakMap();
_traceGrader = new WeakMap();
_narrateTier = new WeakMap();
_macroPipeline = new WeakMap();
_consolidateLearning = new WeakMap();
_consolidation = new WeakMap();
_started = new WeakMap();
_cycleCount = new WeakMap();
_engineErrors = new WeakMap();
_engineErrorCount = new WeakMap();
_lastCycleTime = new WeakMap();
_lastResponse = new WeakMap();
_host = new WeakMap();
_Agent_instances = new WeakSet();
/**
 * The cycle's view of this agent, built once.
 *
 * Every field is `readonly` or read through a closure over `this`, so the record
 * stays correct for the agent's lifetime — and it was previously rebuilt as a
 * twenty-field object with five fresh closures on *every* cycle and every chat
 * turn, two of which are the hottest entry points in the package. The one field
 * a caller can replace afterwards is `macroPipeline`, so that setter drops it.
 */
cycleHost_fn = function() {
  __privateGet(this, _host) ?? __privateSet(this, _host, {
    log: this.log,
    memory: this.memory,
    engines: this.engines,
    policy: this.policy,
    motor: this.motor,
    cortex: this.cortex,
    episodicMemory: this.episodicMemory,
    commandParser: __privateGet(this, _commandParser),
    groundednessGate: __privateGet(this, _groundednessGate),
    traceGrader: __privateGet(this, _traceGrader),
    narrateTier: __privateGet(this, _narrateTier),
    macroPipeline: __privateGet(this, _macroPipeline),
    consolidateLearning: __privateGet(this, _consolidateLearning),
    consolidation: __privateGet(this, _consolidation),
    threadScope: this.threadScope,
    emit: (e) => __privateMethod(this, _Agent_instances, emitCognitive_fn).call(this, e),
    onEngineError: (engineId) => this.onEngineError(engineId),
    getLastResponse: () => __privateGet(this, _lastResponse),
    setLastResponse: (v) => {
      __privateSet(this, _lastResponse, v);
    }
  });
  return __privateGet(this, _host);
};
emitCognitive_fn = function(event) {
  __privateGet(this, _cognitive).emit(event);
};

// src/cognitive-thread.ts
import { BoundedRing as BoundedRing2, makeId as makeId3, perPart, toError } from "@senars/util";

// src/budget.ts
import { clamp, maxScore, occupancy } from "@senars/util";

// src/budget-otel.ts
import { keyedBy } from "@senars/util";

// src/budget-resources.ts
var BUDGET_RESOURCES = {
  cycles: { total: "maxCycles", reason: "cycle-budget", trace: "cycles" },
  depth: { total: "maxDepth", reason: "depth-budget", trace: "depth" },
  memoryOps: { total: "maxMemoryOps", reason: "memory-budget", trace: "memory_ops" },
  llmCalls: { total: "maxLMCalls", reason: "llm-budget", trace: "llm_calls" }
};
var ALL_RESOURCES = Object.keys(BUDGET_RESOURCES);
var traceDimensions = (source, read) => Object.fromEntries(ALL_RESOURCES.map((r) => [BUDGET_RESOURCES[r].trace, read(source, r)]));

// src/event-sink.ts
var sink = null;
function hasDomainEventSink() {
  return sink !== null;
}
function emitDomainEvent(name, scope, payload = {}) {
  sink?.(name, scope, payload);
}

// src/budget-otel.ts
var OTEL_EVENT = {
  "budget:slice:created": "budget.slice.created",
  "budget:slice:consumed": "budget.slice.consumed",
  "budget:slice:exhausted": "budget.slice.exhausted",
  "budget:slice:merged": "budget.slice.merged"
};
var OTEL_KEYS = {
  sliceId: "id",
  parentId: "parent_id",
  childId: "child_id",
  ...Object.fromEntries(
    ALL_RESOURCES.map((r) => [BUDGET_RESOURCES[r].total, `total_${BUDGET_RESOURCES[r].trace}`])
  )
};
var renameKeys = (payload) => keyedBy(
  Object.entries(payload),
  ([key]) => OTEL_KEYS[key] ?? key,
  ([, value]) => value
);
var toTraceConsumed = (consumed) => traceDimensions(consumed, (source, resource) => source[resource]);
var toTraceLimits = (limits) => traceDimensions(limits, (source, resource) => source[BUDGET_RESOURCES[resource].total]);
var TRACE_PROJECTION = {
  "budget:slice:created": (p) => renameKeys(p),
  "budget:slice:consumed": (p) => renameKeys(p),
  "budget:slice:exhausted": (p) => renameKeys({ ...p, consumed: toTraceConsumed(p.consumed), total: toTraceLimits(p.total) }),
  "budget:slice:merged": (p) => renameKeys({ ...p, consumed: toTraceConsumed(p.consumed) })
};
var announceBudgetTrace = (event, payload) => {
  if (!hasDomainEventSink()) return;
  emitDomainEvent(OTEL_EVENT[event], "budget.slice", TRACE_PROJECTION[event](payload));
};

// src/budget.ts
var snapshotBudget = (budget) => ({
  ...budget,
  consumed: { ...budget.consumed }
});
var createBudget = (limits) => ({
  ...limits,
  consumed: zeroConsumed()
});
function buildBudgetSlice(id, parentId, limits, wallclockDeadlineMs, abortSignal) {
  return {
    id,
    parentId,
    ...createBudget(limits),
    wallclockDeadlineMs,
    abortSignal
  };
}
function createBudgetSlice(options, eventBus) {
  const { id, parentId, wallclockDeadlineMs, abortSignal, ...limits } = options;
  const slice = buildBudgetSlice(id, parentId, limits, wallclockDeadlineMs, abortSignal);
  announce2("budget:slice:created", sliceAnnouncement(slice), eventBus);
  return slice;
}
function sliceBudget(parent, childId, allocation, eventBus) {
  const limits = {
    maxCycles: allocation.cycles ?? parent.maxCycles - parent.consumed.cycles,
    maxDepth: allocation.depth ?? parent.maxDepth,
    maxMemoryOps: allocation.memoryOps ?? parent.maxMemoryOps - parent.consumed.memoryOps,
    maxLMCalls: allocation.llmCalls ?? parent.maxLMCalls - parent.consumed.llmCalls
  };
  const slice = buildBudgetSlice(
    childId,
    parent.id,
    limits,
    parent.wallclockDeadlineMs,
    parent.abortSignal
  );
  announce2("budget:slice:created", sliceAnnouncement(slice), eventBus);
  return slice;
}
function announce2(event, payload, eventBus) {
  eventBus?.emit(event, payload);
  announceBudgetTrace(event, payload);
}
var budgetLimitsOf = (budget) => ({
  maxCycles: budget.maxCycles,
  maxDepth: budget.maxDepth,
  maxMemoryOps: budget.maxMemoryOps,
  maxLMCalls: budget.maxLMCalls
});
var budgetLimit = (budget, resource) => budget[BUDGET_RESOURCES[resource].total];
var budgetRemaining = (budget, resource) => budgetLimit(budget, resource) - budget.consumed[resource];
var budgetAffords = (budget, resource, amount) => budgetRemaining(budget, resource) >= amount;
var budgetPressure = (budget, resource) => occupancy(budget.consumed[resource], budgetLimit(budget, resource), 0);
var budgetRefusal = (budget, resource) => budgetRemaining(budget, resource) <= 0 ? BUDGET_RESOURCES[resource].reason : "backpressure";
var chargeBudget = (budget, resource, amount) => {
  budget.consumed[resource] += amount;
};
var sliceCreatedPayload = (sliceId, parentId, limits) => ({
  sliceId,
  parentId,
  ...limits
});
var sliceConsumedPayload = (sliceId, resource, amount, budget) => ({
  sliceId,
  resource,
  amount,
  consumed: budget.consumed[resource],
  total: budgetLimit(budget, resource),
  pressure: budgetPressure(budget, resource)
});
var sliceExhaustedPayload = (sliceId, reason2, budget) => ({
  sliceId,
  reason: reason2,
  consumed: { ...budget.consumed },
  total: budgetLimitsOf(budget)
});
var sliceAnnouncement = (slice) => sliceCreatedPayload(slice.id, slice.parentId, slice);
function consume(budget, resource, amount, eventBus) {
  if (!budgetAffords(budget, resource, amount)) {
    budget.terminationReason = budgetRefusal(budget, resource);
    announce2(
      "budget:slice:exhausted",
      sliceExhaustedPayload(budget.id, budget.terminationReason, budget),
      eventBus
    );
    return false;
  }
  chargeBudget(budget, resource, amount);
  announce2("budget:slice:consumed", sliceConsumedPayload(budget.id, resource, amount, budget), eventBus);
  return true;
}
var consumeCycles = (budget, cycles, eventBus) => consume(budget, "cycles", cycles, eventBus);
var remainingOf = (budget, resource) => clamp(budgetRemaining(budget, resource), 0, Number.POSITIVE_INFINITY);
var remainingCycles = (budget) => remainingOf(budget, "cycles");
var remainingAll = (budget) => {
  const remaining = {};
  for (const resource of ALL_RESOURCES) remaining[resource] = remainingOf(budget, resource);
  return remaining;
};
function resolveAllocation(budget, requested = {}, fallback = () => ({})) {
  const remaining = remainingAll(budget);
  const defaults = fallback(remaining);
  const resolved = {};
  for (const resource of ALL_RESOURCES) {
    resolved[resource] = Math.min(
      requested[resource] ?? defaults[resource] ?? 0,
      remaining[resource]
    );
  }
  return resolved;
}
function chargeAllocation(budget, allocation, eventBus) {
  for (const resource of ALL_RESOURCES) {
    const amount = allocation[resource] ?? 0;
    if (amount > 0) consume(budget, resource, amount, eventBus);
  }
}
function isCapacityExhausted(budget) {
  return ALL_RESOURCES.some((resource) => budgetRemaining(budget, resource) <= 0);
}
function isExhausted(budget) {
  return budget.terminationReason !== void 0 || isCapacityExhausted(budget) || Boolean(budget.wallclockDeadlineMs && Date.now() > budget.wallclockDeadlineMs) || Boolean(budget.abortSignal?.aborted);
}

// src/cognitive-thread.ts
var emitBackpressureDecision = (attributes) => {
  emitDomainEvent("thread.backpressure", "", attributes);
};
var DEFAULT_MAILBOX_CAPACITY = 50;
var createMailbox = (capacity) => new BoundedRing2(capacity, "refuse");
var _CognitiveThread_instances, backpressure_fn;
var _CognitiveThread = class _CognitiveThread {
  constructor(options) {
    __privateAdd(this, _CognitiveThread_instances);
    __publicField(this, "id");
    __publicField(this, "budget");
    __publicField(this, "mailbox");
    __publicField(this, "parentId");
    __publicField(this, "status", "created");
    __publicField(this, "children", /* @__PURE__ */ new Set());
    __publicField(this, "result", null);
    __publicField(this, "error", null);
    __publicField(this, "onComplete");
    __publicField(this, "onError");
    this.id = options.id;
    this.parentId = options.parentBudget.id;
    this.budget = sliceBudget(options.parentBudget, options.id, options.budgetAllocation ?? {});
    this.mailbox = createMailbox(options.mailboxCapacity ?? DEFAULT_MAILBOX_CAPACITY);
  }
  /** Spawn a child thread with hard budget inheritance: Σ(child) ≤ parent.remaining. */
  spawn(childId, allocation) {
    const shares = this.children.size + 2;
    const childAllocation = resolveAllocation(this.budget, allocation, (remaining) => ({
      cycles: perPart(remaining.cycles, shares, 0),
      depth: remaining.depth,
      memoryOps: perPart(remaining.memoryOps, shares, 0),
      llmCalls: perPart(remaining.llmCalls, shares, 0)
    }));
    chargeAllocation(this.budget, childAllocation);
    const child = new _CognitiveThread({
      id: childId,
      parentBudget: this.budget,
      budgetAllocation: childAllocation,
      mailboxCapacity: DEFAULT_MAILBOX_CAPACITY
    });
    this.children.add(child.id);
    return { thread: child, remainingBudget: remainingAll(this.budget) };
  }
  /** Send a message to this thread's mailbox with budget-gated backpressure. */
  send(message) {
    if (isExhausted(this.budget)) {
      __privateMethod(this, _CognitiveThread_instances, backpressure_fn).call(this, false, "budget-exhausted");
      return false;
    }
    if (!consumeCycles(this.budget, 1)) {
      __privateMethod(this, _CognitiveThread_instances, backpressure_fn).call(this, false, "budget-exhausted");
      return false;
    }
    const enqueued = this.mailbox.tryPush({
      ...message,
      id: makeId3(),
      timestamp: Date.now()
    });
    __privateMethod(this, _CognitiveThread_instances, backpressure_fn).call(this, enqueued, enqueued ? "ok" : "mailbox-full");
    return enqueued;
  }
  /** Receive a message from the mailbox. */
  receive() {
    return this.mailbox.shift();
  }
  /** Execute the thread's work function. */
  async run(work) {
    this.status = "running";
    try {
      consumeCycles(this.budget, 1);
      this.result = await work(this);
      this.status = "completed";
      return this.result;
    } catch (err) {
      this.error = toError(err);
      this.status = "error";
      throw this.error;
    }
  }
  /** Wait for thread completion (join) and return unconsumed budget.
   *
   * There is no wait: `run()` is awaited by its caller, so by the time a thread is
   * joined its outcome is already recorded. The shape stays because a genuinely
   * parallel thread pool is the only thing that would need it.
   */
  async join() {
    if (this.error) throw this.error;
    return { result: this.result, unconsumedBudget: remainingAll(this.budget) };
  }
  /** Kill the thread and all children. */
  kill(reason2 = "killed") {
    this.status = "killed";
    this.error = new Error(`Thread killed: ${reason2}`);
  }
  /** Check if thread can continue (budget not exhausted). */
  canContinue() {
    return !isExhausted(this.budget) && this.status === "running";
  }
  /** Consume budget for an operation. Depth, memory ops and LM calls are charged by
   *  their own gates against the slice's own counters, not here. */
  consume(cycles = 1) {
    return consumeCycles(this.budget, cycles);
  }
  /** Get current status. */
  getStatus() {
    return this.status;
  }
  /** Get child thread IDs. */
  getChildren() {
    return [...this.children];
  }
  /** Get thread result. */
  getResult() {
    return this.result;
  }
  /** Get thread error. */
  getError() {
    return this.error;
  }
  /** Get budget consumption snapshot. */
  getBudgetSnapshot() {
    return { ...snapshotBudget(this.budget), id: this.budget.id, parentId: this.budget.parentId };
  }
  /** Get unconsumed budget without joining. */
  getUnconsumedBudget() {
    return remainingAll(this.budget);
  }
};
_CognitiveThread_instances = new WeakSet();
/**
 * Record a backpressure decision. Every reason a send can be refused or
 * admitted reports the same five facts, so the reporting is one call and the
 * only thing a branch chooses is the verdict.
 */
backpressure_fn = function(allowed, reason2) {
  emitBackpressureDecision({
    threadId: this.id,
    allowed,
    reason: reason2,
    budgetRemaining: remainingCycles(this.budget),
    mailboxSize: this.mailbox.size(),
    mailboxCapacity: this.mailbox.capacity
  });
};
var CognitiveThread = _CognitiveThread;
var _ThreadPool_instances, admits_fn;
var ThreadPool = class {
  constructor(rootBudget, maxThreads = 10) {
    __privateAdd(this, _ThreadPool_instances);
    __publicField(this, "threads", /* @__PURE__ */ new Map());
    __publicField(this, "rootBudget");
    __publicField(this, "maxThreads");
    this.rootBudget = rootBudget;
    this.maxThreads = maxThreads;
  }
  /** Spawn a new thread. */
  spawn(id, options) {
    if (!__privateMethod(this, _ThreadPool_instances, admits_fn).call(this, id)) return null;
    const thread = new CognitiveThread({
      id,
      parentBudget: this.rootBudget,
      ...options
    });
    this.threads.set(id, thread);
    return thread;
  }
  /** Spawn a new thread with hard budget inheritance. Returns SpawnResult. */
  spawnWithBudget(id, allocation) {
    if (!__privateMethod(this, _ThreadPool_instances, admits_fn).call(this, id)) return null;
    const childAllocation = resolveAllocation(
      this.rootBudget,
      allocation,
      (remaining) => remaining
    );
    chargeAllocation(this.rootBudget, childAllocation);
    const thread = new CognitiveThread({
      id,
      parentBudget: this.rootBudget,
      budgetAllocation: childAllocation,
      mailboxCapacity: DEFAULT_MAILBOX_CAPACITY
    });
    this.threads.set(id, thread);
    return { thread, remainingBudget: remainingAll(this.rootBudget) };
  }
  /** Get a thread by ID. */
  get(id) {
    return this.threads.get(id);
  }
  /** Kill a thread. */
  kill(id) {
    const thread = this.threads.get(id);
    if (!thread) return false;
    thread.kill();
    this.threads.delete(id);
    return true;
  }
  /** Kill all threads. */
  killAll() {
    for (const thread of this.threads.values()) {
      thread.kill();
    }
    this.threads.clear();
  }
  /** Get all thread statuses. */
  getStatuses() {
    const statuses = /* @__PURE__ */ new Map();
    for (const [id, thread] of this.threads) {
      statuses.set(id, thread.getStatus());
    }
    return statuses;
  }
  /** Wait for all threads to complete. */
  async joinAll() {
    const results = /* @__PURE__ */ new Map();
    for (const [id, thread] of this.threads) {
      try {
        results.set(id, await thread.join());
      } catch (err) {
        results.set(id, err);
      }
    }
    return results;
  }
};
_ThreadPool_instances = new WeakSet();
/** One admission test, so the two spawn paths cannot disagree on reuse or capacity. */
admits_fn = function(id) {
  return !this.threads.has(id) && this.threads.size < this.maxThreads;
};
function createRootBudget(options) {
  return createBudgetSlice({ id: options.id ?? "root", parentId: void 0, ...options });
}
function createCognitiveThread(id, parentBudget, options) {
  return new CognitiveThread({ id, parentBudget, ...options });
}

// src/ModelRunner.ts
import { drain as drain2, errMsg as errMsg5, truncate as truncateText } from "@senars/util";
import {
  generateText,
  stepCountIs,
  streamText
} from "ai";
var DEFAULT_MAX_TOOL_RESULT_ENTRIES = 20;
var DEFAULT_MAX_TOOL_RESULT_CHARS = 8e3;
var ModelRunner = class {
  constructor(deps) {
    __publicField(this, "modelProvider");
    __publicField(this, "maxLoops");
    __publicField(this, "maxOutputTokens");
    __publicField(this, "maxToolResultEntries");
    __publicField(this, "maxToolResultChars");
    this.modelProvider = deps.modelProvider;
    this.maxLoops = deps.maxLoops ?? 5;
    this.maxOutputTokens = deps.maxOutputTokens ?? 2048;
    this.maxToolResultEntries = deps.maxToolResultEntries ?? DEFAULT_MAX_TOOL_RESULT_ENTRIES;
    this.maxToolResultChars = deps.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
  }
  hasModel() {
    return !!this.modelProvider?.available;
  }
  /**
   * The run's result, assembled from its accumulators.
   *
   * Every exit from the generator — a provider that never became available, a
   * thrown stream, an abort, the normal finish — returns this same record, so
   * the fields a caller reads cannot be one shape on the happy path and another
   * on a fault. Each accumulator is read once, here, so the usage totals in the
   * result are the totals the stream reported rather than a re-derivation.
   */
  result(run) {
    return {
      text: run.text,
      toolCalls: run.toolCalls,
      artifacts: run.artifacts,
      errors: run.errors,
      messages: run.messages,
      usage: {
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.inputTokens + run.outputTokens
      }
    };
  }
  async *run(composed, signal) {
    const empty = {
      text: "",
      toolCalls: [],
      artifacts: [],
      errors: [],
      messages: composed.messages,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
    if (!this.modelProvider?.available) return empty;
    const model = this.modelProvider.getModel(composed.tier ?? "fast");
    if (!model) {
      return { ...empty, text: "No model available" };
    }
    const hasTools = Object.keys(composed.tools).length > 0;
    const outcome = {
      text: "",
      toolCalls: [],
      artifacts: [],
      errors: [],
      // Resumable state: input messages + completed assistant turn(s).
      messages: composed.messages,
      inputTokens: 0,
      outputTokens: 0
    };
    try {
      const stream = streamText({
        model,
        messages: this.toMessages(composed),
        instructions: composed.system || void 0,
        tools: hasTools ? composed.tools : void 0,
        stopWhen: hasTools ? stepCountIs(this.maxLoops) : stepCountIs(1),
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: signal,
        onStepFinish: async ({ toolCalls, toolResults }) => {
          for (const tc of toolCalls ?? []) {
            const call = {
              toolName: tc.toolName,
              toolCallId: tc.toolCallId,
              args: tc.input ?? {}
            };
            outcome.toolCalls.push(call);
          }
          for (const tr of toolResults ?? []) {
            const call = outcome.toolCalls.find((c) => c.toolCallId === tr.toolCallId);
            const output = typeof tr.output === "string" ? tr.output : JSON.stringify(tr.output ?? null);
            const capped = truncateText(output, this.maxToolResultChars);
            if (call) {
              outcome.artifacts.push({
                type: "tool_result",
                content: capped,
                timestamp: Date.now(),
                metadata: { toolName: call.toolName, toolCallId: call.toolCallId }
              });
            }
          }
        }
      });
      for await (const delta of stream.textStream) {
        if (delta) {
          outcome.text += delta;
          yield { kind: "text-delta", text: delta };
        }
        if (signal?.aborted) break;
      }
      try {
        outcome.inputTokens += (await stream.usage)?.inputTokens ?? 0;
        outcome.outputTokens += (await stream.usage)?.outputTokens ?? 0;
      } catch {
      }
      void generateText;
      try {
        const steps = await stream.steps;
        const stepMessages = (steps ?? []).flatMap((s) => s.response?.messages ?? []);
        if (stepMessages.length > 0) outcome.messages = [...composed.messages, ...stepMessages];
      } catch {
      }
      for (const c of outcome.toolCalls.slice(0, this.maxToolResultEntries)) {
        yield { kind: "tool-call", call: c };
      }
      const artifacts = outcome.artifacts.slice(0, this.maxToolResultEntries);
      for (const a of artifacts) {
        const call = outcome.toolCalls.find((c) => c.toolCallId === a.metadata?.toolCallId) ?? {
          toolName: String(a.metadata?.toolName ?? "tool"),
          toolCallId: String(a.metadata?.toolCallId ?? ""),
          args: {}
        };
        yield { kind: "tool-result", call, result: a.content };
      }
      if (signal?.aborted)
        yield { kind: "finish", text: outcome.text, toolCalls: outcome.toolCalls };
    } catch (e) {
      if (signal?.aborted) {
        yield { kind: "finish", text: outcome.text, toolCalls: outcome.toolCalls };
        return this.result(outcome);
      }
      outcome.text = errMsg5(e);
      return this.result(outcome);
    }
    yield { kind: "finish", text: outcome.text, toolCalls: outcome.toolCalls };
    return this.result(outcome);
  }
  async runToCompletion(composed, signal) {
    return drain2(this.run(composed, signal));
  }
  toMessages(composed) {
    return composed.messages;
  }
};

// src/cortex/LLMCortex.ts
import { appendTextDelta as appendTextDelta2, collectText as collectText2, estimateTokens, formatTruth } from "@senars/util";
var _runner, _promptBuilder, _LLMCortex_instances, compose_fn, toChatEvent_fn, buildDefaultPrompt_fn, fallbackResponse_fn;
var LLMCortex = class {
  constructor(runner, promptBuilder) {
    __privateAdd(this, _LLMCortex_instances);
    __privateAdd(this, _runner);
    __privateAdd(this, _promptBuilder);
    __privateSet(this, _runner, runner);
    __privateSet(this, _promptBuilder, promptBuilder);
  }
  setPromptBuilder(builder) {
    __privateSet(this, _promptBuilder, builder);
  }
  async *synthesizeStream(req, signal) {
    const composed = __privateMethod(this, _LLMCortex_instances, compose_fn).call(this, req);
    let text = "";
    for await (const ev of __privateGet(this, _runner).run(composed, signal)) {
      yield __privateMethod(this, _LLMCortex_instances, toChatEvent_fn).call(this, ev);
      text = appendTextDelta2(text, ev);
    }
    const finalText = text || __privateMethod(this, _LLMCortex_instances, fallbackResponse_fn).call(this, req);
    if (!text) yield { kind: "text-delta", text: finalText };
    return finalText;
  }
  async synthesize(req) {
    const events = [];
    const text = await collectText2(
      __privateGet(this, _runner).run(__privateMethod(this, _LLMCortex_instances, compose_fn).call(this, req)),
      (ev) => events.push(__privateMethod(this, _LLMCortex_instances, toChatEvent_fn).call(this, ev))
    );
    return { text: text || __privateMethod(this, _LLMCortex_instances, fallbackResponse_fn).call(this, req), events };
  }
};
_runner = new WeakMap();
_promptBuilder = new WeakMap();
_LLMCortex_instances = new WeakSet();
compose_fn = function(req) {
  const systemPrompt = req.systemPrompt ?? __privateMethod(this, _LLMCortex_instances, buildDefaultPrompt_fn).call(this, req);
  const historyText = req.context.working.map((e) => JSON.stringify(e)).join("\n");
  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = estimateTokens(historyText) + estimateTokens(req.stimulus.text);
  return {
    system: systemPrompt,
    messages: [{ role: "user", content: req.stimulus.text }],
    tools: req.tools ?? {},
    tier: req.tier,
    ctxHash: String(Date.now()),
    snapshot: null,
    budget: {
      systemTokens,
      historyTokens,
      snapshotTokens: 0,
      total: systemTokens + historyTokens,
      maxTokens: req.maxTokens ?? 0
    }
  };
};
toChatEvent_fn = function(ev) {
  switch (ev.kind) {
    case "text-delta":
      return { kind: "text-delta", text: ev.text };
    case "tool-call":
      return { kind: "tool-call", toolName: ev.call.toolName, toolArgs: ev.call.args };
    case "tool-result":
      return {
        kind: "tool-result",
        toolName: ev.call.toolName,
        toolArgs: ev.call.args,
        toolResult: ev.result
      };
    case "finish":
      return { kind: "finish", text: ev.text };
    case "tool-error":
      return { kind: "error", error: ev.error };
  }
};
buildDefaultPrompt_fn = function(req) {
  const derivations = req.derivations.map((d) => `- ${d.term}${d.truth ? ` ${formatTruth(d.truth)}` : ""}`).join("\n");
  return [
    "You are a cognitive agent with access to symbolic reasoning engines.",
    "Synthesize a natural language response based on the input and any derivations.",
    "",
    derivations ? `Relevant derivations:
${derivations}` : "",
    "",
    __privateGet(this, _promptBuilder) ? __privateGet(this, _promptBuilder).build({
      ...req,
      workingMemory: req.context.working
    }) : ""
  ].filter(Boolean).join("\n");
};
fallbackResponse_fn = function(req) {
  if (req.derivations.length > 0) {
    return `I derived ${req.derivations.length} result(s).`;
  }
  return `[agent] ${req.stimulus.text}`;
};

// src/cortex/createCortexFromLM.ts
function createCortexFromLM(lmService, promptBuilder, opts) {
  const runner = new ModelRunner({
    modelProvider: lmService,
    maxLoops: opts?.maxLoops ?? 5,
    maxOutputTokens: opts?.maxOutputTokens ?? 2048
  });
  return new LLMCortex(runner, promptBuilder);
}

// src/engine/BaseEngine.ts
var _initialized;
var BaseEngine = class {
  constructor() {
    __privateAdd(this, _initialized, false);
  }
  async initialize() {
    if (__privateGet(this, _initialized)) return;
    await this.doInitialize();
    __privateSet(this, _initialized, true);
  }
  async shutdown() {
    if (!__privateGet(this, _initialized)) return;
    await this.doShutdown();
    __privateSet(this, _initialized, false);
  }
  absorb(result) {
    this.doAbsorb(result);
  }
  doAbsorb(_result) {
  }
};
_initialized = new WeakMap();

// src/eventlog/SqliteEventLog.ts
import { getOrInsert as getOrInsert2 } from "@senars/util";
import Database from "better-sqlite3";
var _db, _config, _statements, _count, _SqliteEventLog_instances, stmt_fn, init_fn, rowToEvent_fn;
var SqliteEventLog = class extends AbstractEventLog {
  constructor(config) {
    super(config);
    __privateAdd(this, _SqliteEventLog_instances);
    __privateAdd(this, _db);
    __privateAdd(this, _config);
    __privateAdd(this, _statements, /* @__PURE__ */ new Map());
    /** Row count, read once at open and carried forward: the log is its own writer. */
    __privateAdd(this, _count, 0);
    __privateSet(this, _config, {
      ...config,
      maxEvents: this.limits.maxEvents,
      maxEventSize: this.limits.maxEventSize
    });
    __privateSet(this, _db, new Database(__privateGet(this, _config).path));
    __privateGet(this, _db).pragma("journal_mode = WAL");
    __privateGet(this, _db).pragma("synchronous = NORMAL");
    __privateMethod(this, _SqliteEventLog_instances, init_fn).call(this);
    const { c } = __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, "SELECT COUNT(*) as c FROM events").get();
    __privateSet(this, _count, c);
  }
  get size() {
    return __privateGet(this, _count);
  }
  get events() {
    const rows = __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, "SELECT * FROM events ORDER BY id").all();
    return rows.map((row) => __privateMethod(this, _SqliteEventLog_instances, rowToEvent_fn).call(this, row));
  }
  async query(query) {
    const clauses = [];
    const params = [];
    if (query.correlationId) {
      clauses.push("correlation_id = ?");
      params.push(query.correlationId);
    }
    if (query.types?.length) {
      clauses.push(`type IN (${query.types.map(() => "?").join(",")})`);
      params.push(...query.types);
    }
    if (query.timeRange) {
      const [start, end] = query.timeRange;
      clauses.push("timestamp >= ? AND timestamp <= ?");
      params.push(start, end);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const order = query.limit !== void 0 ? ` ORDER BY id DESC LIMIT ${Math.max(0, Math.floor(query.limit))}` : " ORDER BY id";
    const rows = __privateGet(this, _db).prepare(`SELECT * FROM events ${where}${order}`).all(...params);
    const events = rows.map((row) => __privateMethod(this, _SqliteEventLog_instances, rowToEvent_fn).call(this, row));
    return query.limit !== void 0 ? events.reverse() : events;
  }
  async getRange(fromId, toId) {
    const stmt = __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, toId ? "SELECT * FROM events WHERE id > ? AND id <= ? ORDER BY id" : "SELECT * FROM events WHERE id > ? ORDER BY id");
    const rows = toId ? stmt.all(fromId, toId) : stmt.all(fromId);
    return rows.map((row) => __privateMethod(this, _SqliteEventLog_instances, rowToEvent_fn).call(this, row));
  }
  async close() {
    this.markClosed();
    __privateGet(this, _statements).clear();
    __privateGet(this, _db).close();
  }
  async doAppend(fullEvent, payloadJson) {
    this.assertAppendable(payloadJson, __privateGet(this, _count) >= this.limits.maxEvents);
    __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, `INSERT INTO events (id, type, payload, timestamp, correlation_id, causation_id)
         VALUES (?, ?, ?, ?, ?, ?)`).run(
      fullEvent.id,
      fullEvent.type,
      payloadJson,
      fullEvent.timestamp,
      fullEvent.correlationId ?? null,
      fullEvent.causationId ?? null
    );
    __privateWrapper(this, _count)._++;
  }
  async getSnapshot(projectionName, version) {
    const row = __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, "SELECT data FROM snapshots WHERE name = ? AND version = ?").get(
      projectionName,
      version
    );
    return row ? JSON.parse(row.data) : null;
  }
  async saveSnapshot(projectionName, version, data) {
    __privateMethod(this, _SqliteEventLog_instances, stmt_fn).call(this, "INSERT INTO snapshots (name, version, data) VALUES (?, ?, ?) ON CONFLICT(name, version) DO UPDATE SET data = excluded.data").run(projectionName, version, JSON.stringify(data));
  }
};
_db = new WeakMap();
_config = new WeakMap();
_statements = new WeakMap();
_count = new WeakMap();
_SqliteEventLog_instances = new WeakSet();
/** Compile-once statement cache; the SQL is the key, so a query shape is stored once. */
stmt_fn = function(sql) {
  return getOrInsert2(__privateGet(this, _statements), sql, () => __privateGet(this, _db).prepare(sql));
};
init_fn = function() {
  __privateGet(this, _db).exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        correlation_id TEXT,
        causation_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_id ON events(id);

      CREATE TABLE IF NOT EXISTS snapshots (
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (name, version)
      );
    `);
};
rowToEvent_fn = function(row) {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    timestamp: row.timestamp,
    correlationId: row.correlation_id ?? void 0,
    causationId: row.causation_id ?? void 0
  };
};

// src/Lifecycle.ts
var VALID_TRANSITIONS = {
  created: ["initialized", "disposed"],
  initialized: ["started", "disposed"],
  started: ["stopped", "disposed"],
  stopped: ["started", "disposed"],
  disposed: []
};
var BaseComponent = class {
  constructor(context) {
    __publicField(this, "_context");
    __publicField(this, "_state", "created");
    this._context = context;
  }
  get state() {
    return this._state;
  }
  get logger() {
    return this._context?.logger;
  }
  get eventBus() {
    return this._context?.eventBus;
  }
  async initialize() {
    if (this._state !== "created") {
      throw new Error(`Cannot initialize component in state: ${this._state}`);
    }
    this.setState("initialized");
  }
  async start() {
    if (this._state !== "initialized") {
      throw new Error(`Cannot start component in state: ${this._state}`);
    }
    this.setState("started");
  }
  async stop() {
    if (this._state !== "started") return;
    this.setState("stopped");
  }
  async dispose() {
    if (this._state === "disposed") return;
    if (this._state === "started") await this.stop();
    this.setState("disposed");
  }
  isRunning() {
    return this._state === "started";
  }
  isInitialized() {
    return this._state === "initialized" || this._state === "started";
  }
  setState(state) {
    const validTransitions = VALID_TRANSITIONS[this._state];
    if (!validTransitions.includes(state)) {
      throw new Error(
        `Invalid state transition from ${this._state} to ${state}. Valid transitions: ${validTransitions.join(", ")}`
      );
    }
    this._state = state;
  }
};

// src/memory/SessionManager.ts
import { BaseLedgerEntrySchema, createLedger } from "@senars/util/ledger";
import {
  abortSession,
  createSession,
  InMemorySessionManager,
  SessionStore
} from "@senars/util/memory";
var SessionRecordSchema = BaseLedgerEntrySchema.extend({
  key: external_exports.string(),
  history: external_exports.array(HistoryEntrySchema),
  createdAt: external_exports.number(),
  lastSeenAt: external_exports.number(),
  metadata: external_exports.record(external_exports.string(), external_exports.unknown())
});
var _ledger, _store;
var JsonlSessionManager = class {
  constructor(config) {
    __privateAdd(this, _ledger);
    __privateAdd(this, _store, new SessionStore());
    __privateSet(this, _ledger, createLedger(config.basePath, SessionRecordSchema));
  }
  getOrCreate(key) {
    return __privateGet(this, _store).getOrCreate(key);
  }
  size() {
    return __privateGet(this, _store).size();
  }
  async restore() {
    for (const entry of await __privateGet(this, _ledger).query({})) {
      __privateGet(this, _store).load(entry.key, {
        id: `sess-${entry.key}`,
        key: entry.key,
        history: entry.history,
        createdAt: entry.createdAt,
        lastSeenAt: entry.lastSeenAt,
        metadata: entry.metadata
      });
    }
  }
  async snapshot() {
    for (const session of __privateGet(this, _store).values()) {
      __privateGet(this, _ledger).append({
        at: session.lastSeenAt,
        key: session.key,
        history: session.history,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        metadata: session.metadata
      });
    }
  }
  async close() {
    await this.snapshot();
    __privateGet(this, _store).clear();
    __privateGet(this, _ledger).close();
  }
};
_ledger = new WeakMap();
_store = new WeakMap();

// src/motor/buildAgentTools.ts
import { objectSpec as objectSpec2, toolAttempt as toolAttempt2, toolError as toolError4, toolOk as toolOk2 } from "@senars/util";
var AGENT_TOOL_SPECS = (deps) => [
  {
    name: "know",
    description: "Store a key-value fact in agent memory",
    parameters: objectSpec2({ key: { type: "string" }, value: { type: "string" } }, "key", "value"),
    execute: async (args) => {
      const { key, value } = args;
      deps.know(key, value);
      return toolOk2({ stored: true, key });
    }
  },
  {
    name: "know_get",
    description: "Retrieve a value from agent memory by key",
    parameters: objectSpec2({ key: { type: "string" } }, "key"),
    execute: async (args) => {
      const value = deps.knowGet(args.key);
      return toolOk2(value !== void 0 ? { found: true, value } : { found: false });
    }
  },
  {
    name: "know_list",
    description: "List all entries in agent memory",
    parameters: objectSpec2({}),
    execute: async () => toolOk2({ entries: deps.knowList() })
  },
  {
    name: "recall",
    description: "Recall episodic memories matching an optional query",
    parameters: objectSpec2({ query: { type: "string" }, limit: { type: "number" } }),
    execute: async (args) => {
      const { query, limit } = args;
      return toolOk2(await deps.recall(query, limit));
    }
  },
  {
    name: "agent_instruct",
    description: "Append or replace agent instructions",
    parameters: objectSpec2(
      {
        mode: { type: "string", enum: ["append", "replace"] },
        instructions: { type: "string" }
      },
      "mode",
      "instructions"
    ),
    execute: async (args) => {
      const { mode, instructions } = args;
      deps.setInstructions?.(mode, instructions);
      return toolOk2({ ok: true, mode });
    }
  },
  {
    name: "get_session_info",
    description: "Get current session info",
    parameters: objectSpec2({}),
    execute: async () => toolOk2(deps.getSessionInfo?.() ?? { messageCount: 0, createdAt: 0, pinnedBeliefs: [] })
  },
  {
    name: "delegate",
    description: "Delegate a self-contained task to a short-lived sub-agent and return its result",
    parameters: objectSpec2({ prompt: { type: "string" } }, "prompt"),
    execute: async (args) => {
      const { prompt } = args;
      if (!deps.delegate) {
        return toolError4("delegation not available in this context");
      }
      return toolAttempt2(
        "Delegation failed",
        () => deps.delegate(prompt),
        (result) => ({ result })
      );
    }
  }
];
function registerAgentTools(motor, deps) {
  for (const spec of AGENT_TOOL_SPECS(deps)) {
    if (!motor.get(spec.name)) motor.register(spec);
  }
}

// src/motor/dispatch.ts
import { errMsg as errMsg6 } from "@senars/util";
async function dispatchToolCalls(calls, ctx) {
  const artifacts = [];
  const errors = [];
  for (const call of calls) {
    const tool2 = ctx.tools[call.toolName];
    if (!tool2) {
      errors.push({ message: `Tool not found: ${call.toolName}` });
      continue;
    }
    try {
      const result = await tool2.execute(call.args);
      if (call.toolName === "nar_believe" && result && typeof result === "object" && "success" in result) {
        const r = result;
        if (r.success) {
          artifacts.push({
            type: "belief_added",
            content: r.statement,
            metadata: { toolCallId: call.toolCallId }
          });
        }
      }
      artifacts.push({
        type: "tool_result",
        content: result,
        metadata: { toolName: call.toolName, toolCallId: call.toolCallId }
      });
    } catch (e) {
      errors.push({ message: errMsg6(e) });
    }
  }
  return { artifacts, errors };
}

// src/PluginLoader.ts
import { errMsg as errMsg7 } from "@senars/util";
import { SenarsError as SenarsError2 } from "@senars/util/errors";
var PluginLoadError = class extends SenarsError2 {
  constructor(pluginId, cause) {
    super(
      `Failed to load plugin "${pluginId}": ${errMsg7(cause)}`,
      "PLUGIN_LOAD_ERROR",
      {
        pluginId
      },
      { cause: cause instanceof Error ? cause : void 0 }
    );
    __publicField(this, "pluginId", pluginId);
    this.name = "PluginLoadError";
  }
};
var _agent, _loaded, _lenses, _transports2, _PluginLoader_instances, context_fn;
var PluginLoader = class {
  constructor(agent) {
    __privateAdd(this, _PluginLoader_instances);
    __privateAdd(this, _agent);
    __privateAdd(this, _loaded, /* @__PURE__ */ new Map());
    __privateAdd(this, _lenses, /* @__PURE__ */ new Map());
    __privateAdd(this, _transports2, /* @__PURE__ */ new Map());
    __privateSet(this, _agent, agent);
  }
  get lenses() {
    return [...__privateGet(this, _lenses).values()];
  }
  get transports() {
    return [...__privateGet(this, _transports2).values()];
  }
  /** Registers all plugin-provided transports into a connection manager. */
  applyTransports(registry) {
    for (const factory of __privateGet(this, _transports2).values()) registry.registerFactory(factory);
  }
  async load(plugins) {
    for (const plugin of plugins) {
      try {
        this.activate(plugin);
      } catch (e) {
        throw new PluginLoadError(plugin.id, e);
      }
    }
  }
  /**
   * Discovers plugins from module specifiers and activates them.
   * Each specifier must resolve to a module exporting a `SenarsPlugin`
   * (as default or named `plugin`).
   */
  async discover(specifiers) {
    const plugins = [];
    for (const spec of specifiers) {
      try {
        const mod = await import(spec);
        const candidate = mod.plugin ?? mod.default;
        if (!candidate?.id) {
          throw new Error(`module "${spec}" does not export a SenarsPlugin`);
        }
        plugins.push(candidate);
      } catch (e) {
        throw new PluginLoadError(spec, e);
      }
    }
    await this.load(plugins);
  }
  /**
   * Discovers plugin specifiers declared under `senars.plugins` in a
   * package.json (absolute path) and activates each.
   */
  async discoverFromManifest(manifestPath) {
    const fs = await import("fs");
    if (!fs.existsSync(manifestPath)) return;
    const raw = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    const specifiers = manifest.senars?.plugins ?? [];
    await this.discover(specifiers);
  }
  activate(plugin) {
    if (__privateGet(this, _loaded).has(plugin.id)) return;
    const off = plugin.activate(__privateMethod(this, _PluginLoader_instances, context_fn).call(this));
    __privateGet(this, _loaded).set(plugin.id, {
      plugin,
      deactivate: off ?? (() => {
      })
    });
  }
  unload(id) {
    const entry = __privateGet(this, _loaded).get(id);
    if (!entry) return;
    try {
      entry.plugin.deactivate();
    } catch {
    }
    try {
      entry.deactivate();
    } catch {
    }
    __privateGet(this, _loaded).delete(id);
  }
  unloadAll() {
    for (const id of [...__privateGet(this, _loaded).keys()]) this.unload(id);
  }
};
_agent = new WeakMap();
_loaded = new WeakMap();
_lenses = new WeakMap();
_transports2 = new WeakMap();
_PluginLoader_instances = new WeakSet();
context_fn = function() {
  const agent = __privateGet(this, _agent);
  const self = this;
  return {
    agent,
    registerEngine(id, engine) {
      agent.registerEngine(id, engine);
    },
    registerTool(spec) {
      agent.motor.register(spec);
    },
    registerLens(spec) {
      __privateGet(self, _lenses).set(spec.id, spec);
    },
    registerTransport(factory) {
      __privateGet(self, _transports2).set(factory.id, factory);
    },
    addMemoryTier(name, impl) {
      agent.memory.addTier(name, impl);
    },
    onCognitive(handler) {
      agent.on("*", handler);
      return () => agent.off("*", handler);
    }
  };
};

// src/plugins/index.ts
function createTransportPlugin(opts) {
  const factory = {
    id: opts.id,
    type: opts.type,
    create: (config, deps) => new opts.ctor(config, deps)
  };
  return {
    id: opts.id,
    name: opts.name,
    version: opts.version ?? "1.0.0",
    activate(ctx) {
      ctx.registerTransport(factory);
    },
    deactivate() {
    }
  };
}
function createLensPlugin(spec) {
  return {
    id: `lens:${spec.id}`,
    name: `Lens \xB7 ${spec.label}`,
    version: "1.0.0",
    activate(ctx) {
      ctx.registerLens(spec);
    },
    deactivate() {
    }
  };
}
function createToolPlugin(spec) {
  return {
    id: `tool:${spec.name}`,
    name: `Tool \xB7 ${spec.name}`,
    version: "1.0.0",
    activate(ctx) {
      ctx.registerTool(spec);
    },
    deactivate() {
    }
  };
}
function builtinLensPlugins() {
  return builtinLensSpecs().map(createLensPlugin);
}

// src/verify-derivation.ts
import {
  confidenceToWeight as c2w,
  formatIssues,
  nearlyEqual,
  safeRatio,
  softSquash,
  weightToConfidence as w2c
} from "@senars/util";
var div = safeRatio;
var DEFAULT_EPSILON = 1e-6;
var BINARY_TRUTH = {
  deduction: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
  induction: (f1, f2, c1, c2) => {
    const w = f2 * c1 * c2;
    return [f2, softSquash(w)];
  },
  abduction: (f1, f2, c1, c2) => {
    const w = f1 * c1 * c2;
    return [f1, softSquash(w)];
  },
  exemplification: (f1, f2, c1, c2) => [f1 * f2, softSquash(c1) * c1 * c2 * f1 * f2],
  comparison: (f1, f2, c1, c2) => {
    const p = f1 * f2;
    return [div(p, p + (1 - f1) * (1 - f2)), c1 * c2];
  },
  analogy: (f1, f2, c1, c2) => [f1 * f2, c1 * c2 * f2],
  resemblance: (f1, f2, c1, c2) => [(f1 + f2) / 2, c1 * c2],
  intersection: (f1, f2, c1, c2) => [f1 * f2, c1 * c2],
  union: (f1, f2, c1, c2) => [1 - (1 - f1) * (1 - f2), c1 * c2],
  revision: (f1, f2, c1, c2) => {
    const w1 = c2w(c1);
    const w2 = c2w(c2);
    return [div(f1 * w1 + f2 * w2, w1 + w2), Math.min(w2c(w1 + w2), 0.999)];
  },
  detachment: (f1, f2, c1, c2) => [f2, f1 * c1 * c2],
  contraposition: (f1, f2, c1, c2) => {
    const cf = f2 * (1 - f1);
    return [div(cf, cf + (1 - f2) * f1), c1 * c2];
  },
  sameness: (f1, f2, c1, c2) => [1 - Math.abs(f1 - f2), c1 * c2]
};
var UNARY_TRUTH = {
  "negation-intro": (f, c) => [1 - f, c],
  "negation-elim": (f, c) => [1 - f, c],
  negation: (f, c) => [1 - f, c],
  conversion: (f, c) => [f, f * c]
};
var VERIFIER_TRUTH_TABLE = { BINARY_TRUTH, UNARY_TRUTH };
var declaredTruthFn = (name) => {
  if (!name) return null;
  const binary = BINARY_TRUTH[name];
  if (binary) return { arity: 2, fn: (f, c) => binary(f[0], f[1], c[0], c[1]) };
  const unary = UNARY_TRUTH[name];
  if (unary) return { arity: 1, fn: (f, c) => unary(f[0], c[0]) };
  return null;
};
var inferTruthFnFromRuleId = (ruleId) => {
  const key = ruleId.toLowerCase().replace(/_/g, "-");
  return declaredTruthFn(key) ?? bySubstring(key);
};
var bySubstring = (key) => {
  const binaryName = Object.keys(BINARY_TRUTH).find((name) => key.includes(name));
  if (binaryName !== void 0) {
    const fn = BINARY_TRUTH[binaryName];
    return { arity: 2, fn: (f, c) => fn(f[0], f[1], c[0], c[1]) };
  }
  const unaryName = Object.keys(UNARY_TRUTH).find((name) => key.includes(name));
  if (unaryName !== void 0) {
    const fn = UNARY_TRUTH[unaryName];
    return { arity: 1, fn: (f, c) => fn(f[0], c[0]) };
  }
  return null;
};
var resolveTruthFn = (ruleId, declaredName) => declaredTruthFn(declaredName) ?? inferTruthFnFromRuleId(ruleId);
var formatFinding = (finding) => `[${finding.check}]${finding.stepId ? ` step ${finding.stepId}` : ""}: ${finding.detail}`;
var verifyStep = (step, priorStepIds, taskId, options, state) => {
  const findings = [];
  const fail = (check, detail) => {
    findings.push({ stepId: step.stepId, check, detail });
  };
  if (!step.ruleId.trim()) fail("rule-shape", "Missing ruleId");
  if (step.premises.length === 0) fail("premise-shape", "No premises provided");
  if (step.premises.some((p) => !p.trim())) fail("premise-shape", "Empty premise term string");
  if (!step.conclusion.trim()) fail("conclusion-shape", "Empty conclusion term string");
  for (const [variable, value] of Object.entries(step.substitution ?? {})) {
    if (!value.trim()) fail("substitution-value", `Variable ${variable} binds empty value`);
    else if (!step.premises.some((p) => p.includes(variable)))
      fail("substitution-premise", `Variable ${variable} appears in no premise`);
    else if (!step.conclusion.includes(variable) && !step.conclusion.includes(value))
      fail("substitution-conclusion", `Neither ${variable} nor its value appears in conclusion`);
  }
  for (const parent of step.evidenceLineage) {
    if (!priorStepIds.has(parent) && parent !== taskId)
      fail("lineage-dag", `Lineage ${parent} is neither a prior step nor the taskId`);
  }
  if (step.independence === "unknown" && step.ruleId.toLowerCase().includes("revision"))
    fail(
      "evidence-independence",
      "Revision with unknown independence must be conservatively rejected by the engine"
    );
  let computedTruth;
  const resolved = resolveTruthFn(step.ruleId, step.truthFn);
  if (!resolved) {
    state.skipped++;
    if (options.strict) fail("unknown-rule", `No truth function for ruleId '${step.ruleId}'`);
  } else if (step.premiseTruths?.length !== resolved.arity) {
    state.skipped++;
  } else {
    const [f, c] = resolved.fn(
      step.premiseTruths.map((t) => t.frequency),
      step.premiseTruths.map((t) => t.confidence)
    );
    computedTruth = { frequency: f, confidence: c };
    if (nearlyEqual(f, step.truth.frequency, options.epsilon) && nearlyEqual(c, step.truth.confidence, options.epsilon))
      state.verified++;
    else
      fail(
        "truth-algebra",
        `Expected f=${f.toFixed(6)} c=${c.toFixed(6)}, got f=${step.truth.frequency} c=${step.truth.confidence} via ${step.ruleId}`
      );
  }
  return {
    stepId: step.stepId,
    ok: findings.length === 0,
    errors: findings.map(formatFinding),
    findings,
    declaredTruth: step.truth,
    ...computedTruth ? { computedTruth } : {}
  };
};
function verifyRecord(record2, options = {}) {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const findings = [];
  const stepResults = [];
  const state = { verified: 0, skipped: 0 };
  const fail = (check, detail, stepId) => {
    findings.push({ stepId, check, detail });
  };
  const parsed = DerivationRecordSchema.safeParse(record2);
  if (!parsed.success) {
    fail("record-shape", formatIssues(parsed.error.issues));
  } else {
    const { steps, finalTruth, taskId, totalCycles } = parsed.data;
    const toVerify = options.maxSteps ? steps.slice(0, options.maxSteps) : steps;
    const seen = /* @__PURE__ */ new Set();
    const stepOptions = { epsilon, strict: options.strict ?? false };
    for (const step of toVerify) {
      if (seen.has(step.stepId))
        fail("unique-step-id", `Duplicate stepId ${step.stepId}`, step.stepId);
      stepResults.push(verifyStep(step, seen, taskId, stepOptions, state));
      seen.add(step.stepId);
    }
    for (const result of stepResults) findings.push(...result.findings);
    const last = toVerify[toVerify.length - 1];
    if (last) {
      if (!nearlyEqual(last.truth.frequency, finalTruth.frequency, epsilon) || !nearlyEqual(last.truth.confidence, finalTruth.confidence, epsilon))
        fail("final-truth", "finalTruth does not match last step truth");
    } else if (totalCycles > 0) {
      fail("empty-derivation", "Record claims cycles but has no steps");
    }
  }
  return {
    derivationId: record2?.derivationId ?? "",
    ok: findings.length === 0,
    errors: findings.map(formatFinding),
    findings,
    stepResults,
    truthVerified: state.verified,
    truthSkipped: state.skipped,
    verifiedAt: Date.now()
  };
}

// src/Transport.ts
import { ConnectionError } from "@senars/util/errors";
export {
  Agent,
  AgentCapabilities,
  ApprovalService,
  BUILTIN_LENS_IDS,
  BUILTIN_TOOLS,
  BaseComponent,
  BaseEngine,
  CONNECTION_COLORS,
  ChatMessage,
  CognitiveDelta,
  CognitiveThread,
  ConfigField,
  ConnectionError,
  EDGE_LABELS,
  EDGE_TYPES,
  GraphNodeData,
  GraphNodeDataStrict,
  GraphOp,
  InMemoryApprovalManager,
  InMemoryEventLog,
  InMemorySessionManager,
  IncomingFromClient,
  IncomingFromServer,
  JsonlSessionManager,
  LENS_COLORS_HEX,
  LENS_DESCRIPTIONS,
  LENS_FIELDS,
  LENS_LABELS,
  LLMCortex,
  LMSwitchMsg,
  Lens,
  LensSpecSchema,
  Logger,
  MemoryService,
  MettaAtomNode,
  MettaSkillNode,
  ModelRunner,
  ModulationSchema,
  NarConceptNode,
  PluginLoadError,
  PluginLoader,
  PolicyEngine,
  ServerError,
  SqliteEventLog,
  ThreadPool,
  ToolRegistry,
  VERIFIER_TRUTH_TABLE,
  WORKSPACE_ROOT,
  abortSession,
  agentOptionsSchema,
  builtinLensPlugins,
  builtinLensSpecs,
  clamp2 as clamp,
  clamp01,
  compact,
  contextOptsSchema,
  createBuiltinTools,
  createCognitiveThread,
  createCortexFromLM,
  createLensPlugin,
  createLogger2 as createLogger,
  createRootBudget,
  createSession,
  createToolPlugin,
  createTransportPlugin,
  defaultLogger,
  dispatchToolCalls,
  edgeKey,
  edgeTypeLabel,
  ensureArray,
  errMsg8 as errMsg,
  estimateTokens2 as estimateTokens,
  extractTerm,
  generateId4 as generateId,
  isBuiltinLens,
  isEventType,
  isNarEvent,
  isNarsese,
  isNil,
  lensSpecToJsonSchema,
  makeId4 as makeId,
  registerAgentTools,
  registerBuiltinTools,
  registerLogEnricher,
  resolveTruthFn,
  sleep,
  taskTypeForPunctuation,
  toError2 as toError,
  verifyRecord,
  withinWorkspace
};
