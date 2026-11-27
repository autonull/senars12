import { z } from 'zod';
export declare const uuid: () => z.ZodString;
export declare const nonEmpty: () => z.ZodString;
export declare const nonNegativeInt: () => z.ZodNumber;
export declare const positiveInt: () => z.ZodNumber;
export declare const unitInterval: () => z.ZodNumber;
export declare const signedUnitInterval: () => z.ZodNumber;
export declare const timestamp: () => z.ZodNumber;
export declare const temperature: () => z.ZodNumber;
/** UUID string (RFC 4122). */
export type UUID = string;
/** Unix timestamp in milliseconds. */
export type TimestampMs = number;
import { type EngineOrigin } from '@senars/util/origins';
import { type TaskType, type TaskBagKind, type TolerantPunctuation } from '@senars/schemas/task';
export declare const SOURCE_QUALITY: readonly ["PRIMARY", "SECONDARY", "GENERAL", "TERTIARY", "LLM_PRIOR", "PEER_AGENT", "SELF_METTA"];
export type SOURCE_QUALITY = (typeof SOURCE_QUALITY)[number];
export declare const AMBIGUITY_TYPES: readonly ["parse", "intent", "term", "reference", "quantifier", "modal", "temporal", "negation"];
export type AMBIGUITY_TYPE = (typeof AMBIGUITY_TYPES)[number];
export declare const AMBIGUITY_SEVERITIES: readonly ["low", "medium", "high"];
export type AMBIGUITY_SEVERITY = (typeof AMBIGUITY_SEVERITIES)[number];
export declare const DETECTED_INTENTS: readonly ["chat", "command", "reasoning", "learning"];
export type DETECTED_INTENT = (typeof DETECTED_INTENTS)[number];
export declare const STIMULUS_SOURCES: readonly ["user", "llm", "derivation", "reflex", "sensor"];
export type STIMULUS_SOURCE = (typeof STIMULUS_SOURCES)[number];
export declare const AUTONOMY_MODES: readonly ["observe-only", "propose-only", "sandbox-execute", "low-risk-auto-merge", "human-approved-production"];
export type AUTONOMY_MODE = (typeof AUTONOMY_MODES)[number];
export declare const AUTONOMITY_AUTHORITIES: readonly ["system", "human", "external-governance"];
export type AUTONOMITY_AUTHORITIE = (typeof AUTONOMITY_AUTHORITIES)[number];
export declare const RISK_LEVELS: readonly ["LOW", "MEDIUM", "HIGH"];
export type RISK_LEVEL = (typeof RISK_LEVELS)[number];
export declare const CAPABILITY_RISKS: readonly ["low", "medium", "high"];
export type CAPABILITY_RISK = (typeof CAPABILITY_RISKS)[number];
export declare const GAME_DOMAINS: readonly ["external", "self"];
export type GAME_DOMAIN = (typeof GAME_DOMAINS)[number];
export declare const REWARD_DOMAINS: readonly ["external-reflex", "self-scheduler", "self-config-proposal", "self-patch-score", "self-explanation-rank"];
export type REWARD_DOMAIN = (typeof REWARD_DOMAINS)[number];
export declare const RULE_CATEGORIES: readonly ["core", "logic", "propositional", "higher-order", "comparison", "classical", "structural", "temporal", "procedural", "meta-cognitive", "variable"];
export type RULE_CATEGORIE = (typeof RULE_CATEGORIES)[number];
export declare const RULE_PROVENANCE_KINDS: readonly ["builtin", "proposal", "import"];
export type RULE_PROVENANCE_KIND = (typeof RULE_PROVENANCE_KINDS)[number];
export declare const PROPOSAL_KINDS: readonly ["content", "rule"];
export type PROPOSAL_KIND = (typeof PROPOSAL_KINDS)[number];
export declare const PROPOSAL_REJECTIONS: readonly ["schema-version", "stale-revision", "evicted-reference", "queue-overflow", "cancelled", "failed-schema"];
export type PROPOSAL_REJECTION = (typeof PROPOSAL_REJECTIONS)[number];
export declare const BUDGET_SCOPE_IDS: readonly ["derivations", "premises", "candidate-derivations", "proposal-application", "control-work", "decision-derivations"];
export type BUDGET_SCOPE_ID = (typeof BUDGET_SCOPE_IDS)[number];
export declare const BUDGET_TYPES: readonly ["cycles", "depth", "memory", "llm"];
export type BUDGET_TYPE = (typeof BUDGET_TYPES)[number];
export declare const TERMINATION_REASONS: readonly ["cycle-budget", "depth-budget", "memory-budget", "llm-budget", "deadline", "backpressure", "aborted", "completed"];
export type TERMINATION_REASON = (typeof TERMINATION_REASONS)[number];
export declare const BUDGET_OPERATIONS: readonly ["nal-step", "lm-call", "memory-op", "derivation-depth", "systemone-judgment", "derivation", "premise-selection", "candidate-derivation", "proposal-application", "control-work", "decision-derivation"];
export type BUDGET_OPERATION = (typeof BUDGET_OPERATIONS)[number];
export declare const GATE_NAMES: readonly ["perception", "action", "reward", "budget"];
export type GATE_NAME = (typeof GATE_NAMES)[number];
export declare const REWARD_TYPES: readonly ["extrinsic", "intrinsic", "derivation-depth-reduction", "self-model-accuracy", "contradiction-reduction"];
export type REWARD_TYPE = (typeof REWARD_TYPES)[number];
export declare const REWARD_TARGET_TYPES: readonly ["attention-priority", "policy-weights", "truth-frequency", "truth-confidence"];
export type REWARD_TARGET_TYPE = (typeof REWARD_TARGET_TYPES)[number];
export declare const VIOLATION_TYPES: readonly ["unauthorized-tool", "budget-exceeded", "epistemic-firewall", "sandbox-escape", "self-mod-unauthorized"];
export type VIOLATION_TYPE = (typeof VIOLATION_TYPES)[number];
export declare const SEVERITY_LEVELS: readonly ["warn", "block", "quarantine"];
export type SEVERITY_LEVEL = (typeof SEVERITY_LEVELS)[number];
export declare const SELF_IMPROVEMENT_KINDS: readonly ["knob-tune", "focus-weight", "strategy-switch", "schema-promotion", "patch-apply", "test-generate", "schema-evolution", "metta-rule-adoption"];
export type SELF_IMPROVEMENT_KIND = (typeof SELF_IMPROVEMENT_KINDS)[number];
export declare const GOVERNANCE_ACTIONS: readonly ["AUTO_MERGE", "CREATE_PR", "REQUIRE_HUMAN_REVIEW", "REJECT"];
export type GOVERNANCE_ACTION = (typeof GOVERNANCE_ACTIONS)[number];
export declare const GOVERNANCE_DECISIONS: readonly ["AUTO_MERGED", "PR_CREATED", "HUMAN_REVIEW_REQUIRED", "REJECTED"];
export type GOVERNANCE_DECISION = (typeof GOVERNANCE_DECISIONS)[number];
export declare const GOVERNANCE_DECIDED_BY: readonly ["governance-runner", "human-reviewer", "security-team"];
export type GOVERNANCE_DECIDED_BY = (typeof GOVERNANCE_DECIDED_BY)[number];
export declare const ACTIVATION_SOURCES: readonly ["perception", "goal", "derivation", "decay", "associative"];
export type ACTIVATION_SOURCE = (typeof ACTIVATION_SOURCES)[number];
export declare const KERNEL_CONTROL_STATES: readonly ["running", "paused", "stepping"];
export type KERNEL_CONTROL_STATE = (typeof KERNEL_CONTROL_STATES)[number];
export declare const CONFLICT_TYPES: readonly ["frequency", "semantic"];
export type CONFLICT_TYPE = (typeof CONFLICT_TYPES)[number];
export declare const HEALTH_STATUSES: readonly ["healthy", "degraded", "stuck", "crashed"];
export type HEALTH_STATUSE = (typeof HEALTH_STATUSES)[number];
export declare const SHADOW_SOURCES: readonly ["llm", "bridge-llm"];
export type SHADOW_SOURCE = (typeof SHADOW_SOURCES)[number];
export declare const STAMP_TYPES: readonly ["standard", "provisional"];
export type STAMP_TYPE = (typeof STAMP_TYPES)[number];
export declare const EGRESS_GATES: readonly ["groundedness", "risk"];
export type EGRESS_GATE = (typeof EGRESS_GATES)[number];
export declare const INDEPENDENCE: readonly ["independent", "dependent", "unknown"];
export type INDEPENDENCE = (typeof INDEPENDENCE)[number];
export type ENGINE_ORIGIN = EngineOrigin;
export type TASK_TYPE = TaskType;
export type TASK_BAG_KIND = TaskBagKind;
export type TOLERANT_PUNCTUATION = TolerantPunctuation;
export declare const TASK_PUNCTUATION_MAP: {
    readonly belief: ".";
    readonly goal: "!";
    readonly question: "?";
    readonly command: ";";
};
export declare const SOURCE_QUALITY_CONFIDENCE: {
    readonly PRIMARY: 0.9;
    readonly SECONDARY: 0.7;
    readonly GENERAL: 0.55;
    readonly TERTIARY: 0.4;
    readonly LLM_PRIOR: 0.5;
    readonly PEER_AGENT: 0.6;
    readonly SELF_METTA: 0.7;
};
export declare const AMBIGUITY_SEVERITY: {
    readonly parse: "high";
    readonly intent: "high";
    readonly term: "medium";
    readonly reference: "low";
    readonly quantifier: "medium";
    readonly modal: "medium";
    readonly temporal: "low";
    readonly negation: "high";
};
export declare const RISK_LEVEL_BY_CAPABILITY_RISK: {
    readonly low: "LOW";
    readonly medium: "MEDIUM";
    readonly high: "HIGH";
};
export declare const BUDGET_TYPES_MAP: {
    readonly cycles: "cycles";
    readonly depth: "depth";
    readonly memoryOps: "memory";
    readonly llmCalls: "llm";
};
export declare const PROPOSAL_RISK: {
    readonly "focus-weight": "low";
    readonly "strategy-switch": "low";
    readonly "knob-tune": "medium";
    readonly "schema-promotion": "medium";
    readonly "test-generate": "medium";
    readonly "patch-apply": "high";
    readonly "schema-evolution": "low";
    readonly "metta-rule-adoption": "low";
};
export declare const NON_EXECUTING_MODES: readonly ["observe-only", "propose-only"];
export declare const BUILTIN_RULE_ARTIFACT_VERSION: "builtin/1";
export declare const RULE_TABLE_SCHEMA_VERSION: 1;
export declare const PROPOSAL_SCHEMA_VERSION: 2;
/** The 0..1 truth pair every event payload, derivation record, and formalization candidate carries. */
export declare const TruthValueSchema: z.ZodObject<{
    frequency: z.ZodNumber;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export type TruthValue = z.infer<typeof TruthValueSchema>;
/** Where a claim came from. Provenance is what bounds its confidence. */
export declare const SourceQualitySchema: z.ZodEnum<{
    GENERAL: "GENERAL";
    LLM_PRIOR: "LLM_PRIOR";
    PEER_AGENT: "PEER_AGENT";
    PRIMARY: "PRIMARY";
    SECONDARY: "SECONDARY";
    SELF_METTA: "SELF_METTA";
    TERTIARY: "TERTIARY";
}>;
export type SourceQuality = z.infer<typeof SourceQualitySchema>;
/** A source's track record, as the one thing it is allowed to do to a ceiling: lower it. */
export interface CeilingReputation {
    effectiveCeiling(base: number, key: string): number;
}
export interface CeilingLimits {
    reputation?: CeilingReputation;
    sourceKey?: string;
    atMost?: number;
    scaledBy?: number;
}
export declare const confidenceCeiling: (quality: SourceQuality, limits?: CeilingLimits) => number;
export declare const RulePatternSideSchema: z.ZodObject<{
    op: z.ZodString;
}, z.core.$strip>;
export type RulePatternSide = z.infer<typeof RulePatternSideSchema>;
export declare const RulePatternSchema: z.ZodObject<{
    left: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
    right: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RulePattern = z.infer<typeof RulePatternSchema>;
export declare const BudgetSchema: z.ZodObject<{
    priority: z.ZodNumber;
    durability: z.ZodNumber;
    quality: z.ZodNumber;
    cycles: z.ZodNumber;
    depth: z.ZodNumber;
}, z.core.$strip>;
export type Budget = z.infer<typeof BudgetSchema>;
/** One turn of conversation history. Re-exported from @senars/util. */
export interface HistoryEntry {
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: number;
}
export declare const HistoryEntrySchema: z.ZodObject<{
    role: z.ZodEnum<{
        agent: "agent";
        system: "system";
        user: "user";
    }>;
    content: z.ZodString;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export declare const IndependenceSchema: z.ZodEnum<{
    dependent: "dependent";
    independent: "independent";
    unknown: "unknown";
}>;
export type Independence = z.infer<typeof IndependenceSchema>;
export declare const ambiguitySeverityOf: (type: AMBIGUITY_TYPE) => typeof AMBIGUITY_SEVERITIES[number];
export type AmbiguityType = AMBIGUITY_TYPE;
export declare const AmbiguityReportSchema: z.ZodObject<{
    type: z.ZodEnum<{
        intent: "intent";
        modal: "modal";
        negation: "negation";
        parse: "parse";
        quantifier: "quantifier";
        reference: "reference";
        temporal: "temporal";
        term: "term";
    }>;
    description: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export type AmbiguityReport = z.infer<typeof AmbiguityReportSchema>;
export declare const AmbiguityFlagSchema: z.ZodObject<{
    type: z.ZodEnum<{
        intent: "intent";
        modal: "modal";
        negation: "negation";
        parse: "parse";
        quantifier: "quantifier";
        reference: "reference";
        temporal: "temporal";
        term: "term";
    }>;
    description: z.ZodString;
    options: z.ZodArray<z.ZodString>;
    confidence: z.ZodNumber;
    severity: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
}, z.core.$strip>;
export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;
export declare const SourceSpanSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
    text: z.ZodString;
}, z.core.$strip>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export declare const FormalizationCandidateSchema: z.ZodObject<{
    candidateId: z.ZodString;
    narsese: z.ZodString;
    taskType: z.ZodEnum<{
        [x: string]: any;
    }>;
    truth: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
    confidence: z.ZodNumber;
    sourceSpans: z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>>;
    ambiguityFlags: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            intent: "intent";
            modal: "modal";
            negation: "negation";
            parse: "parse";
            quantifier: "quantifier";
            reference: "reference";
            temporal: "temporal";
            term: "term";
        }>;
        description: z.ZodString;
        options: z.ZodArray<z.ZodString>;
        confidence: z.ZodNumber;
        severity: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
    }, z.core.$strip>>;
    metadata: z.ZodOptional<z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        promptTokens: z.ZodOptional<z.ZodNumber>;
        completionTokens: z.ZodOptional<z.ZodNumber>;
        latencyMs: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type FormalizationCandidate = z.infer<typeof FormalizationCandidateSchema>;
export declare const FormalizationBatchSchema: z.ZodObject<{
    batchId: z.ZodString;
    sourceText: z.ZodString;
    candidates: z.ZodArray<z.ZodObject<{
        candidateId: z.ZodString;
        narsese: z.ZodString;
        taskType: z.ZodEnum<{
            [x: string]: any;
        }>;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        confidence: z.ZodNumber;
        sourceSpans: z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
            text: z.ZodString;
        }, z.core.$strip>>;
        ambiguityFlags: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                intent: "intent";
                modal: "modal";
                negation: "negation";
                parse: "parse";
                quantifier: "quantifier";
                reference: "reference";
                temporal: "temporal";
                term: "term";
            }>;
            description: z.ZodString;
            options: z.ZodArray<z.ZodString>;
            confidence: z.ZodNumber;
            severity: z.ZodEnum<{
                high: "high";
                low: "low";
                medium: "medium";
            }>;
        }, z.core.$strip>>;
        metadata: z.ZodOptional<z.ZodObject<{
            model: z.ZodOptional<z.ZodString>;
            promptTokens: z.ZodOptional<z.ZodNumber>;
            completionTokens: z.ZodOptional<z.ZodNumber>;
            latencyMs: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    detectedIntent: z.ZodOptional<z.ZodEnum<{
        chat: "chat";
        command: "command";
        learning: "learning";
        reasoning: "reasoning";
    }>>;
    globalAmbiguities: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            intent: "intent";
            modal: "modal";
            negation: "negation";
            parse: "parse";
            quantifier: "quantifier";
            reference: "reference";
            temporal: "temporal";
            term: "term";
        }>;
        description: z.ZodString;
        options: z.ZodArray<z.ZodString>;
        confidence: z.ZodNumber;
        severity: z.ZodEnum<{
            high: "high";
            low: "low";
            medium: "medium";
        }>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type FormalizationBatch = z.infer<typeof FormalizationBatchSchema>;
export declare const DetectedIntentSchema: z.ZodEnum<{
    chat: "chat";
    command: "command";
    learning: "learning";
    reasoning: "reasoning";
}>;
export type DetectedIntent = z.infer<typeof DetectedIntentSchema>;
export declare const LMGenerateTextQuerySchema: z.ZodObject<{
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        task: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxOutputTokens: z.ZodOptional<z.ZodNumber>;
        signal: z.ZodOptional<z.ZodAny>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type LMGenerateTextQuery = z.infer<typeof LMGenerateTextQuerySchema>;
export declare const LMGenerateTextResultSchema: z.ZodObject<{
    text: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        promptTokens: z.ZodNumber;
        completionTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type LMGenerateTextResult = z.infer<typeof LMGenerateTextResultSchema>;
export declare const LMGenerateTextCertSchema: z.ZodObject<{
    model: z.ZodString;
    promptHash: z.ZodString;
    seed: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LMGenerateTextCert = z.infer<typeof LMGenerateTextCertSchema>;
export declare const LMGenerateObjectQuerySchema: z.ZodObject<{
    prompt: z.ZodString;
    schema: z.ZodAny;
    options: z.ZodOptional<z.ZodObject<{
        task: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxOutputTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type LMGenerateObjectQuery = z.infer<typeof LMGenerateObjectQuerySchema>;
export declare const LMGenerateObjectResultSchema: z.ZodObject<{
    object: z.ZodAny;
    usage: z.ZodOptional<z.ZodObject<{
        promptTokens: z.ZodNumber;
        completionTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type LMGenerateObjectResult = z.infer<typeof LMGenerateObjectResultSchema>;
export declare const LMGenerateObjectCertSchema: z.ZodObject<{
    model: z.ZodString;
    promptHash: z.ZodString;
    schemaHash: z.ZodString;
    seed: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LMGenerateObjectCert = z.infer<typeof LMGenerateObjectCertSchema>;
export declare const LMStreamQuerySchema: z.ZodObject<{
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        task: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxOutputTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type LMStreamQuery = z.infer<typeof LMStreamQuerySchema>;
export declare const LMStreamResultSchema: z.ZodObject<{
    stream: z.ZodAny;
}, z.core.$strip>;
export type LMStreamResult = z.infer<typeof LMStreamResultSchema>;
export declare const LMStreamCertSchema: z.ZodObject<{
    model: z.ZodString;
    promptHash: z.ZodString;
    seed: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LMStreamCert = z.infer<typeof LMStreamCertSchema>;
export declare const RetrievalQuerySchema: z.ZodObject<{
    query: z.ZodString;
    topK: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;
export declare const RetrievalResultSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        score: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
export declare const RetrievalCertSchema: z.ZodObject<{
    index: z.ZodString;
    queryHash: z.ZodString;
    embeddingModel: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RetrievalCert = z.infer<typeof RetrievalCertSchema>;
export declare const EngineZ3QuerySchema: z.ZodObject<{
    formula: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineZ3Query = z.infer<typeof EngineZ3QuerySchema>;
export declare const EngineZ3ResultSchema: z.ZodObject<{
    satisfiable: z.ZodBoolean;
    model: z.ZodOptional<z.ZodAny>;
    proof: z.ZodOptional<z.ZodString>;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
        nodesVisited: z.ZodOptional<z.ZodNumber>;
        clausesGenerated: z.ZodOptional<z.ZodNumber>;
        backtracks: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineZ3Result = z.infer<typeof EngineZ3ResultSchema>;
export declare const EngineZ3CertSchema: z.ZodObject<{
    engine: z.ZodLiteral<"z3">;
    formulaHash: z.ZodString;
    proof: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EngineZ3Cert = z.infer<typeof EngineZ3CertSchema>;
export declare const EngineClingoQuerySchema: z.ZodObject<{
    program: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineClingoQuery = z.infer<typeof EngineClingoQuerySchema>;
export declare const EngineClingoResultSchema: z.ZodObject<{
    satisfiable: z.ZodBoolean;
    models: z.ZodOptional<z.ZodArray<z.ZodAny>>;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
        modelsFound: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineClingoResult = z.infer<typeof EngineClingoResultSchema>;
export declare const EngineClingoCertSchema: z.ZodObject<{
    engine: z.ZodLiteral<"clingo">;
    programHash: z.ZodString;
    modelHash: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EngineClingoCert = z.infer<typeof EngineClingoCertSchema>;
export declare const EngineMiniSatQuerySchema: z.ZodObject<{
    cnf: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineMiniSatQuery = z.infer<typeof EngineMiniSatQuerySchema>;
export declare const EngineMiniSatResultSchema: z.ZodObject<{
    satisfiable: z.ZodBoolean;
    model: z.ZodOptional<z.ZodAny>;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
        decisions: z.ZodOptional<z.ZodNumber>;
        conflicts: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineMiniSatResult = z.infer<typeof EngineMiniSatResultSchema>;
export declare const EngineMiniSatCertSchema: z.ZodObject<{
    engine: z.ZodLiteral<"minisat">;
    cnfHash: z.ZodString;
    modelHash: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EngineMiniSatCert = z.infer<typeof EngineMiniSatCertSchema>;
export declare const EngineTauPrologQuerySchema: z.ZodObject<{
    program: z.ZodString;
    query: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineTauPrologQuery = z.infer<typeof EngineTauPrologQuerySchema>;
export declare const EngineTauPrologResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    bindings: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
        inferences: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineTauPrologResult = z.infer<typeof EngineTauPrologResultSchema>;
export declare const EngineTauPrologCertSchema: z.ZodObject<{
    engine: z.ZodLiteral<"tau-prolog">;
    programHash: z.ZodString;
    queryHash: z.ZodString;
}, z.core.$strip>;
export type EngineTauPrologCert = z.infer<typeof EngineTauPrologCertSchema>;
export declare const EngineMettaQuerySchema: z.ZodObject<{
    program: z.ZodString;
    query: z.ZodOptional<z.ZodString>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineMettaQuery = z.infer<typeof EngineMettaQuerySchema>;
export declare const EngineMettaResultSchema: z.ZodObject<{
    result: z.ZodAny;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineMettaResult = z.infer<typeof EngineMettaResultSchema>;
export declare const EngineMettaCertSchema: z.ZodObject<{
    engine: z.ZodLiteral<"metta">;
    programHash: z.ZodString;
    queryHash: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EngineMettaCert = z.infer<typeof EngineMettaCertSchema>;
export declare const EngineCustomQuerySchema: z.ZodObject<{
    engine: z.ZodString;
    payload: z.ZodAny;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type EngineCustomQuery = z.infer<typeof EngineCustomQuerySchema>;
export declare const EngineCustomResultSchema: z.ZodObject<{
    result: z.ZodAny;
    statistics: z.ZodOptional<z.ZodObject<{
        timeMs: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EngineCustomResult = z.infer<typeof EngineCustomResultSchema>;
export declare const EngineCustomCertSchema: z.ZodObject<{
    engine: z.ZodString;
    payloadHash: z.ZodString;
}, z.core.$strip>;
export type EngineCustomCert = z.infer<typeof EngineCustomCertSchema>;
export declare const FormalizationNLToFormalQuerySchema: z.ZodObject<{
    text: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type FormalizationNLToFormalQuery = z.infer<typeof FormalizationNLToFormalQuerySchema>;
export declare const FormalizationNLToFormalResultSchema: z.ZodObject<{
    narsese: z.ZodString;
    confidence: z.ZodNumber;
    ambiguities: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        description: z.ZodString;
        options: z.ZodArray<z.ZodString>;
        confidence: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type FormalizationNLToFormalResult = z.infer<typeof FormalizationNLToFormalResultSchema>;
export declare const FormalizationNLToFormalCertSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    textHash: z.ZodString;
}, z.core.$strip>;
export type FormalizationNLToFormalCert = z.infer<typeof FormalizationNLToFormalCertSchema>;
export declare const FormalizationFormalToNLQuerySchema: z.ZodObject<{
    narsese: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type FormalizationFormalToNLQuery = z.infer<typeof FormalizationFormalToNLQuerySchema>;
export declare const FormalizationFormalToNLResultSchema: z.ZodObject<{
    text: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strip>;
export type FormalizationFormalToNLResult = z.infer<typeof FormalizationFormalToNLResultSchema>;
export declare const FormalizationFormalToNLCertSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    narseseHash: z.ZodString;
}, z.core.$strip>;
export type FormalizationFormalToNLCert = z.infer<typeof FormalizationFormalToNLCertSchema>;
export declare const TermOpSchema: z.ZodEnum<{
    "!": "!";
    "#": "#";
    "&": "&";
    "*": "*";
    "-->": "-->";
    ".": ".";
    ";": ";";
    "<->": "<->";
    "<=>": "<=>";
    "==>": "==>";
    "?": "?";
    "@": "@";
    const: "const";
    var: "var";
    "|": "|";
    "|>": "|>";
    "||": "||";
    "|~": "|~";
    "~": "~";
}>;
export type TermOp = z.infer<typeof TermOpSchema>;
export declare const VariableTermSchema: z.ZodObject<{
    op: z.ZodLiteral<"var">;
    name: z.ZodString;
    index: z.ZodNumber;
    hash: z.ZodNumber;
    complexity: z.ZodNumber;
}, z.core.$strip>;
export type VariableTerm = z.infer<typeof VariableTermSchema>;
export declare const ConstantTermSchema: z.ZodObject<{
    op: z.ZodLiteral<"const">;
    value: z.ZodString;
    hash: z.ZodNumber;
    complexity: z.ZodNumber;
}, z.core.$strip>;
export type ConstantTerm = z.infer<typeof ConstantTermSchema>;
export declare const CompoundTermOpSchema: z.ZodEnum<{
    "!": "!";
    "#": "#";
    "&": "&";
    "*": "*";
    "-->": "-->";
    ".": ".";
    ";": ";";
    "<->": "<->";
    "<=>": "<=>";
    "==>": "==>";
    "?": "?";
    "@": "@";
    "|": "|";
    "|>": "|>";
    "||": "||";
    "|~": "|~";
    "~": "~";
}>;
export type CompoundTermOp = z.infer<typeof CompoundTermOpSchema>;
export declare const CompoundTermSchema: z.ZodObject<{
    op: z.ZodEnum<{
        "!": "!";
        "#": "#";
        "&": "&";
        "*": "*";
        "-->": "-->";
        ".": ".";
        ";": ";";
        "<->": "<->";
        "<=>": "<=>";
        "==>": "==>";
        "?": "?";
        "@": "@";
        "|": "|";
        "|>": "|>";
        "||": "||";
        "|~": "|~";
        "~": "~";
    }>;
    args: z.ZodArray<z.ZodLazy<z.ZodTypeAny<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>>;
    arity: z.ZodNumber;
    hash: z.ZodNumber;
    complexity: z.ZodNumber;
}, z.core.$strip>;
export type CompoundTerm = z.infer<typeof CompoundTermSchema>;
export declare const TermSchema: z.ZodTypeAny;
export type Term = z.infer<typeof TermSchema>;
export declare const StampSchema: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodNumber;
    parents: z.ZodArray<z.ZodString>;
    derivation: z.ZodArray<z.ZodString>;
    evidence: z.ZodNumber;
}, z.core.$strip>;
export type Stamp = z.infer<typeof StampSchema>;
export declare const BudgetScopeIdSchema: z.ZodEnum<{
    "candidate-derivations": "candidate-derivations";
    "control-work": "control-work";
    "decision-derivations": "decision-derivations";
    derivations: "derivations";
    premises: "premises";
    "proposal-application": "proposal-application";
}>;
export type BudgetScopeId = z.infer<typeof BudgetScopeIdSchema>;
export declare const BudgetTypeSchema: z.ZodEnum<{
    cycles: "cycles";
    depth: "depth";
    llm: "llm";
    memory: "memory";
}>;
export type BudgetType = z.infer<typeof BudgetTypeSchema>;
export declare const PerceptionGateInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    source: z.ZodOptional<z.ZodEnum<{
        derivation: "derivation";
        llm: "llm";
        reflex: "reflex";
        sensor: "sensor";
        user: "user";
    }>>;
    rawObservation: z.ZodUnknown;
    sensorConfidence: z.ZodNumber;
    sourceQuality: z.ZodEnum<{
        GENERAL: "GENERAL";
        LLM_PRIOR: "LLM_PRIOR";
        PEER_AGENT: "PEER_AGENT";
        PRIMARY: "PRIMARY";
        SECONDARY: "SECONDARY";
        SELF_METTA: "SELF_METTA";
        TERTIARY: "TERTIARY";
    }>;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PerceptionGateInput = z.infer<typeof PerceptionGateInputSchema>;
export declare const ActionGateInputSchema: z.ZodObject<{
    proposalId: z.ZodString;
    operation: z.ZodString;
    args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    proposerReflexId: z.ZodOptional<z.ZodString>;
    nalDerivationId: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ActionGateInput = z.infer<typeof ActionGateInputSchema>;
export declare const ActionGateOutputSchema: z.ZodObject<{
    authorized: z.ZodBoolean;
    toolCallId: z.ZodOptional<z.ZodString>;
    vetoReason: z.ZodOptional<z.ZodString>;
    requiredApprovals: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type ActionGateOutput = z.infer<typeof ActionGateOutputSchema>;
export declare const RewardGateInputSchema: z.ZodObject<{
    eventId: z.ZodString;
    rewardSignal: z.ZodNumber;
    rewardType: z.ZodEnum<{
        "contradiction-reduction": "contradiction-reduction";
        "derivation-depth-reduction": "derivation-depth-reduction";
        extrinsic: "extrinsic";
        intrinsic: "intrinsic";
        "self-model-accuracy": "self-model-accuracy";
    }>;
    targetType: z.ZodEnum<{
        "attention-priority": "attention-priority";
        "policy-weights": "policy-weights";
        "truth-confidence": "truth-confidence";
        "truth-frequency": "truth-frequency";
    }>;
    targetId: z.ZodString;
    domain: z.ZodOptional<z.ZodEnum<{
        "external-reflex": "external-reflex";
        "self-config-proposal": "self-config-proposal";
        "self-explanation-rank": "self-explanation-rank";
        "self-patch-score": "self-patch-score";
        "self-scheduler": "self-scheduler";
    }>>;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RewardGateInput = z.infer<typeof RewardGateInputSchema>;
export declare const RewardGateOutputSchema: z.ZodObject<{
    accepted: z.ZodBoolean;
    mutationApplied: z.ZodOptional<z.ZodBoolean>;
    epistemicFirewallViolation: z.ZodOptional<z.ZodBoolean>;
    rejectionReason: z.ZodOptional<z.ZodString>;
    requiresProposal: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type RewardGateOutput = z.infer<typeof RewardGateOutputSchema>;
export declare const BudgetOperationSchema: z.ZodEnum<{
    "candidate-derivation": "candidate-derivation";
    "control-work": "control-work";
    "decision-derivation": "decision-derivation";
    derivation: "derivation";
    "derivation-depth": "derivation-depth";
    "lm-call": "lm-call";
    "memory-op": "memory-op";
    "nal-step": "nal-step";
    "premise-selection": "premise-selection";
    "proposal-application": "proposal-application";
    "systemone-judgment": "systemone-judgment";
}>;
export type BudgetOperation = z.infer<typeof BudgetOperationSchema>;
export declare const AutonomyModeSchema: z.ZodEnum<{
    "human-approved-production": "human-approved-production";
    "low-risk-auto-merge": "low-risk-auto-merge";
    "observe-only": "observe-only";
    "propose-only": "propose-only";
    "sandbox-execute": "sandbox-execute";
}>;
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;
export declare const AutonomyAuthoritySchema: z.ZodEnum<{
    "external-governance": "external-governance";
    human: "human";
    system: "system";
}>;
export type AutonomyAuthority = z.infer<typeof AutonomyAuthoritySchema>;
export declare const RiskLevelSchema: z.ZodEnum<{
    HIGH: "HIGH";
    LOW: "LOW";
    MEDIUM: "MEDIUM";
}>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export declare const GameDomainSchema: z.ZodEnum<{
    external: "external";
    self: "self";
}>;
export type GameDomain = z.infer<typeof GameDomainSchema>;
export declare const RewardDomainSchema: z.ZodEnum<{
    "external-reflex": "external-reflex";
    "self-config-proposal": "self-config-proposal";
    "self-explanation-rank": "self-explanation-rank";
    "self-patch-score": "self-patch-score";
    "self-scheduler": "self-scheduler";
}>;
export type RewardDomain = z.infer<typeof RewardDomainSchema>;
export declare const PatchProposalSchema: z.ZodObject<{
    proposalId: z.ZodString;
    patchRef: z.ZodString;
    baseCommit: z.ZodString;
    patchDiff: z.ZodString;
    ciResults: z.ZodObject<{
        test: z.ZodBoolean;
        typecheck: z.ZodBoolean;
        lint: z.ZodBoolean;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
    riskSelfAssessment: z.ZodEnum<{
        HIGH: "HIGH";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
    }>;
    affectedComponents: z.ZodArray<z.ZodEnum<{
        "approval-logic": "approval-logic";
        "autonomy-mode": "autonomy-mode";
        "cognitive-params": "cognitive-params";
        "kernel-gates": "kernel-gates";
        memory: "memory";
        other: "other";
        "reward-functions": "reward-functions";
        rules: "rules";
        "sandbox-config": "sandbox-config";
        tools: "tools";
    }>>;
    affectedFiles: z.ZodArray<z.ZodString>;
    linesAdded: z.ZodNumber;
    linesRemoved: z.ZodNumber;
    coverageDelta: z.ZodOptional<z.ZodNumber>;
    rationale: z.ZodString;
    timestamp: z.ZodNumber;
    agentSignature: z.ZodString;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PatchProposal = z.infer<typeof PatchProposalSchema>;
export declare const SelfImprovementProposalSchema: z.ZodObject<{
    proposalId: z.ZodString;
    kind: z.ZodEnum<{
        "focus-weight": "focus-weight";
        "knob-tune": "knob-tune";
        "metta-rule-adoption": "metta-rule-adoption";
        "patch-apply": "patch-apply";
        "schema-evolution": "schema-evolution";
        "schema-promotion": "schema-promotion";
        "strategy-switch": "strategy-switch";
        "test-generate": "test-generate";
    }>;
    riskTier: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    rewardDomain: z.ZodEnum<{
        "external-reflex": "external-reflex";
        "self-config-proposal": "self-config-proposal";
        "self-explanation-rank": "self-explanation-rank";
        "self-patch-score": "self-patch-score";
        "self-scheduler": "self-scheduler";
    }>;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SelfImprovementProposal = z.infer<typeof SelfImprovementProposalSchema>;
export declare const proposalRisk: (kind: SelfImprovementProposal['kind']) => SelfImprovementProposal['riskTier'];
export declare const RiskAssessmentSchema: z.ZodObject<{
    risk: z.ZodEnum<{
        HIGH: "HIGH";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
    }>;
    score: z.ZodNumber;
    factors: z.ZodArray<z.ZodObject<{
        factor: z.ZodString;
        file: z.ZodOptional<z.ZodString>;
        component: z.ZodOptional<z.ZodString>;
        severity: z.ZodEnum<{
            HIGH: "HIGH";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export declare const GovernanceDecisionSchema: z.ZodObject<{
    action: z.ZodEnum<{
        AUTO_MERGE: "AUTO_MERGE";
        CREATE_PR: "CREATE_PR";
        REJECT: "REJECT";
        REQUIRE_HUMAN_REVIEW: "REQUIRE_HUMAN_REVIEW";
    }>;
    reason: z.ZodString;
    reviewers: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;
export declare const GovernanceEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    proposalId: z.ZodString;
    decision: z.ZodEnum<{
        AUTO_MERGED: "AUTO_MERGED";
        HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED";
        PR_CREATED: "PR_CREATED";
        REJECTED: "REJECTED";
    }>;
    riskLevel: z.ZodEnum<{
        HIGH: "HIGH";
        LOW: "LOW";
        MEDIUM: "MEDIUM";
    }>;
    autonomyMode: z.ZodEnum<{
        "human-approved-production": "human-approved-production";
        "low-risk-auto-merge": "low-risk-auto-merge";
        "observe-only": "observe-only";
        "propose-only": "propose-only";
        "sandbox-execute": "sandbox-execute";
    }>;
    decidedAt: z.ZodNumber;
    decidedBy: z.ZodEnum<{
        "governance-runner": "governance-runner";
        "human-reviewer": "human-reviewer";
        "security-team": "security-team";
    }>;
}, z.core.$strip>;
export type GovernanceEvent = z.infer<typeof GovernanceEventSchema>;
export declare const RuleProvenanceSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"builtin">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"proposal">;
    proposalId: z.ZodString;
    producer: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"import">;
    source: z.ZodString;
}, z.core.$strip>], "kind">;
export type RuleProvenance = z.infer<typeof RuleProvenanceSchema>;
export declare const RuleDeclarationSchema: z.ZodObject<{
    left: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
    right: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
    ruleId: z.ZodString;
    description: z.ZodString;
    truthFn: z.ZodString;
    body: z.ZodString;
    priority: z.ZodNumber;
    taskType: z.ZodOptional<z.ZodEnum<{
        [x: string]: any;
    }>>;
}, z.core.$strip>;
export type RuleDeclaration = z.infer<typeof RuleDeclarationSchema>;
export declare const RuleArtifactEntrySchema: z.ZodObject<{
    left: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
    right: z.ZodObject<{
        op: z.ZodString;
    }, z.core.$strip>;
    ruleId: z.ZodString;
    description: z.ZodString;
    truthFn: z.ZodString;
    body: z.ZodString;
    priority: z.ZodNumber;
    taskType: z.ZodOptional<z.ZodEnum<{
        [x: string]: any;
    }>>;
    artifactVersion: z.ZodString;
    ruleSetRevision: z.ZodNumber;
    parentRevision: z.ZodNullable<z.ZodNumber>;
    ruleSchemaVersion: z.ZodNumber;
    provenance: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"builtin">;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"proposal">;
        proposalId: z.ZodString;
        producer: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"import">;
        source: z.ZodString;
    }, z.core.$strip>], "kind">;
    eventId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RuleArtifactEntry = z.infer<typeof RuleArtifactEntrySchema>;
export declare const RuleTableSchema: z.ZodObject<{
    schemaVersion: z.ZodNumber;
    artifactVersion: z.ZodString;
    revision: z.ZodNumber;
    entries: z.ZodArray<z.ZodObject<{
        left: z.ZodObject<{
            op: z.ZodString;
        }, z.core.$strip>;
        right: z.ZodObject<{
            op: z.ZodString;
        }, z.core.$strip>;
        ruleId: z.ZodString;
        description: z.ZodString;
        truthFn: z.ZodString;
        body: z.ZodString;
        priority: z.ZodNumber;
        taskType: z.ZodOptional<z.ZodEnum<{
            [x: string]: any;
        }>>;
        artifactVersion: z.ZodString;
        ruleSetRevision: z.ZodNumber;
        parentRevision: z.ZodNullable<z.ZodNumber>;
        ruleSchemaVersion: z.ZodNumber;
        provenance: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"builtin">;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"proposal">;
            proposalId: z.ZodString;
            producer: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"import">;
            source: z.ZodString;
        }, z.core.$strip>], "kind">;
        eventId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RuleTable = z.infer<typeof RuleTableSchema>;
export interface RuleTableDiff {
    readonly from: number;
    readonly to: number;
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly superseded: readonly string[];
    readonly unchanged: number;
}
export declare const RULE_TABLE_REJECTIONS: readonly ['schema-version', 'artifact-version', 'duplicate-rule-id', 'unresolved-body', 'empty-id'];
export type RuleTableRejection = (typeof RULE_TABLE_REJECTIONS)[number];
export interface RuleTableFault {
    readonly ruleId: string;
    readonly reason: RuleTableRejection;
    readonly detail: string;
}
export declare const EngineOriginSchema: z.ZodEnum<{
    [x: string]: any;
}>;
export declare const CognitiveEventBaseSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PROPOSER_ORIGIN: 'proposer';
export declare const NAR_ORIGIN: 'nar';
export declare const KernelControlStateSchema: z.ZodEnum<{
    paused: "paused";
    running: "running";
    stepping: "stepping";
}>;
export type KernelControlState = z.infer<typeof KernelControlStateSchema>;
export declare const CapabilityRiskSchema: z.ZodEnum<{
    high: "high";
    low: "low";
    medium: "medium";
}>;
export type CapabilityRisk = z.infer<typeof CapabilityRiskSchema>;
export declare const StimulusSourceSchema: z.ZodEnum<{
    derivation: "derivation";
    llm: "llm";
    reflex: "reflex";
    sensor: "sensor";
    user: "user";
}>;
export type StimulusSource = (typeof STIMULUS_SOURCES)[number];
export declare const TaskAdmittedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"task.admitted">;
    payload: z.ZodObject<{
        taskId: z.ZodString;
        term: z.ZodString;
        taskType: any;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodEnum<{
            derivation: "derivation";
            llm: "llm";
            reflex: "reflex";
            sensor: "sensor";
            user: "user";
        }>;
        budget: z.ZodObject<{
            priority: z.ZodNumber;
            durability: z.ZodNumber;
            quality: z.ZodNumber;
            cycles: z.ZodNumber;
            depth: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DerivationAcceptedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"derivation.accepted">;
    payload: z.ZodObject<{
        derivationId: z.ZodString;
        ruleId: z.ZodString;
        ruleCategory: z.ZodOptional<z.ZodEnum<{
            classical: "classical";
            comparison: "comparison";
            core: "core";
            "higher-order": "higher-order";
            logic: "logic";
            "meta-cognitive": "meta-cognitive";
            procedural: "procedural";
            propositional: "propositional";
            structural: "structural";
            temporal: "temporal";
            variable: "variable";
        }>>;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>>;
        truthFn: z.ZodOptional<z.ZodString>;
        evidenceLineage: z.ZodArray<z.ZodString>;
        independenceCheck: z.ZodEnum<{
            dependent: "dependent";
            independent: "independent";
            unknown: "unknown";
        }>;
        cycle: z.ZodOptional<z.ZodNumber>;
        correlationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BeliefRevisedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"belief.revised">;
    payload: z.ZodObject<{
        term: z.ZodString;
        oldTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        newTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        evidenceLineage: z.ZodOptional<z.ZodArray<z.ZodString>>;
        revisionRule: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConceptActivatedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"concept.activated">;
    payload: z.ZodObject<{
        term: z.ZodString;
        priority: z.ZodNumber;
        activationSource: z.ZodOptional<z.ZodEnum<{
            associative: "associative";
            decay: "decay";
            derivation: "derivation";
            goal: "goal";
            perception: "perception";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BudgetExhaustedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"budget.exhausted">;
    payload: z.ZodObject<{
        budgetType: z.ZodEnum<{
            cycles: "cycles";
            depth: "depth";
            llm: "llm";
            memory: "memory";
        }>;
        remaining: z.ZodNumber;
        limit: z.ZodNumber;
        terminationReason: z.ZodEnum<{
            aborted: "aborted";
            backpressure: "backpressure";
            completed: "completed";
            "cycle-budget": "cycle-budget";
            deadline: "deadline";
            "depth-budget": "depth-budget";
            "llm-budget": "llm-budget";
            "memory-budget": "memory-budget";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const PolicyViolationEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"policy.violation">;
    payload: z.ZodObject<{
        policyId: z.ZodString;
        violationType: z.ZodEnum<{
            "budget-exceeded": "budget-exceeded";
            "epistemic-firewall": "epistemic-firewall";
            "sandbox-escape": "sandbox-escape";
            "self-mod-unauthorized": "self-mod-unauthorized";
            "unauthorized-tool": "unauthorized-tool";
        }>;
        detail: z.ZodString;
        severity: z.ZodEnum<{
            block: "block";
            quarantine: "quarantine";
            warn: "warn";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const AutonomyModeChangedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"autonomy.mode.changed">;
    payload: z.ZodObject<{
        previousMode: z.ZodEnum<{
            "human-approved-production": "human-approved-production";
            "low-risk-auto-merge": "low-risk-auto-merge";
            "observe-only": "observe-only";
            "propose-only": "propose-only";
            "sandbox-execute": "sandbox-execute";
        }>;
        newMode: z.ZodEnum<{
            "human-approved-production": "human-approved-production";
            "low-risk-auto-merge": "low-risk-auto-merge";
            "observe-only": "observe-only";
            "propose-only": "propose-only";
            "sandbox-execute": "sandbox-execute";
        }>;
        authorizedBy: z.ZodEnum<{
            "external-governance": "external-governance";
            human: "human";
            system: "system";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SelfModProposalEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"self-mod.proposal">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        patchRef: z.ZodString;
        baseCommit: z.ZodString;
        patchDiff: z.ZodString;
        ciResults: z.ZodObject<{
            test: z.ZodBoolean;
            typecheck: z.ZodBoolean;
            lint: z.ZodBoolean;
            durationMs: z.ZodNumber;
        }, z.core.$strip>;
        riskSelfAssessment: z.ZodEnum<{
            HIGH: "HIGH";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
        }>;
        affectedComponents: z.ZodArray<z.ZodEnum<{
            "approval-logic": "approval-logic";
            "autonomy-mode": "autonomy-mode";
            "cognitive-params": "cognitive-params";
            "kernel-gates": "kernel-gates";
            memory: "memory";
            other: "other";
            "reward-functions": "reward-functions";
            rules: "rules";
            "sandbox-config": "sandbox-config";
            tools: "tools";
        }>>;
        affectedFiles: z.ZodArray<z.ZodString>;
        linesAdded: z.ZodNumber;
        linesRemoved: z.ZodNumber;
        coverageDelta: z.ZodOptional<z.ZodNumber>;
        rationale: z.ZodString;
        timestamp: z.ZodNumber;
        agentSignature: z.ZodString;
        correlationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const JudgmentResolvedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"judgment.resolved">;
    payload: z.ZodObject<{
        queryId: z.ZodString;
        shape: z.ZodString;
        axis: z.ZodString;
        backendId: z.ZodString;
        tier: z.ZodNumber;
        latencyMs: z.ZodNumber;
        entropy: z.ZodOptional<z.ZodNumber>;
        abstained: z.ZodBoolean;
        stampType: z.ZodEnum<{
            provisional: "provisional";
            standard: "standard";
        }>;
        calibrationVersion: z.ZodString;
        encoderDigest: z.ZodOptional<z.ZodString>;
        modelDigest: z.ZodOptional<z.ZodString>;
        calibrationDigest: z.ZodOptional<z.ZodString>;
        inputDigest: z.ZodOptional<z.ZodString>;
        decisionBand: z.ZodOptional<z.ZodUnknown>;
        cost: z.ZodObject<{
            tokensIn: z.ZodNumber;
            tokensOut: z.ZodNumber;
            computeMs: z.ZodNumber;
            memoryMb: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type JudgmentResolvedEvent = z.infer<typeof JudgmentResolvedEventSchema>;
export declare const GatePassedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"gate.passed">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            action: "action";
            budget: "budget";
            perception: "perception";
            reward: "reward";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GateFailedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"gate.failed">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            action: "action";
            budget: "budget";
            perception: "perception";
            reward: "reward";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BudgetConsumedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"budget.consumed">;
    payload: z.ZodObject<{
        budgetType: z.ZodEnum<{
            cycles: "cycles";
            depth: "depth";
            llm: "llm";
            memory: "memory";
        }>;
        amount: z.ZodNumber;
        remaining: z.ZodNumber;
        limit: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const EgressGateRejectedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"egress.gate.rejected">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            groundedness: "groundedness";
            risk: "risk";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ShadowValidationDropEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"shadow.validation.dropped">;
    payload: z.ZodObject<{
        candidateTerm: z.ZodString;
        source: z.ZodEnum<{
            "bridge-llm": "bridge-llm";
            llm: "llm";
        }>;
        conflictType: z.ZodEnum<{
            frequency: "frequency";
            semantic: "semantic";
        }>;
        frequencyDelta: z.ZodOptional<z.ZodNumber>;
        semanticScore: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProposalSubmittedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.submitted">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        revision: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SnapshotCreatedEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"snapshot.created">;
    payload: z.ZodObject<{
        snapshotId: z.ZodString;
        cycle: z.ZodNumber;
        entryCount: z.ZodNumber;
        hash: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SnapshotRestoredEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"snapshot.restored">;
    payload: z.ZodObject<{
        snapshotId: z.ZodString;
        cycle: z.ZodNumber;
        entriesReplayed: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const RuleCategorySchema: z.ZodEnum<{
    classical: "classical";
    comparison: "comparison";
    core: "core";
    "higher-order": "higher-order";
    logic: "logic";
    "meta-cognitive": "meta-cognitive";
    procedural: "procedural";
    propositional: "propositional";
    structural: "structural";
    temporal: "temporal";
    variable: "variable";
}>;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export declare const DerivationStepSchema: z.ZodObject<{
    stepId: z.ZodString;
    ruleId: z.ZodString;
    ruleCategory: z.ZodEnum<{
        classical: "classical";
        comparison: "comparison";
        core: "core";
        "higher-order": "higher-order";
        logic: "logic";
        "meta-cognitive": "meta-cognitive";
        procedural: "procedural";
        propositional: "propositional";
        structural: "structural";
        temporal: "temporal";
        variable: "variable";
    }>;
    premises: z.ZodArray<z.ZodString>;
    conclusion: z.ZodString;
    truth: z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
    truthFn: z.ZodOptional<z.ZodString>;
    substitution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>>>;
    evidenceLineage: z.ZodArray<z.ZodString>;
    independence: z.ZodEnum<{
        dependent: "dependent";
        independent: "independent";
        unknown: "unknown";
    }>;
    cycle: z.ZodOptional<z.ZodNumber>;
    correlationId: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const DerivationRecordSchema: z.ZodObject<{
    derivationId: z.ZodString;
    taskId: z.ZodString;
    goalTerm: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        stepId: z.ZodString;
        ruleId: z.ZodString;
        ruleCategory: z.ZodEnum<{
            classical: "classical";
            comparison: "comparison";
            core: "core";
            "higher-order": "higher-order";
            logic: "logic";
            "meta-cognitive": "meta-cognitive";
            procedural: "procedural";
            propositional: "propositional";
            structural: "structural";
            temporal: "temporal";
            variable: "variable";
        }>;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        truthFn: z.ZodOptional<z.ZodString>;
        substitution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>>;
        evidenceLineage: z.ZodArray<z.ZodString>;
        independence: z.ZodEnum<{
            dependent: "dependent";
            independent: "independent";
            unknown: "unknown";
        }>;
        cycle: z.ZodOptional<z.ZodNumber>;
        correlationId: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    finalTruth: z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
    totalCycles: z.ZodNumber;
    maxDepthReached: z.ZodNumber;
    timestamp: z.ZodNumber;
    engine: z.ZodLiteral<"nar">;
}, z.core.$strip>;
export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;
export type DerivationStep = z.infer<typeof DerivationStepSchema>;
export declare const DerivationRecordEventSchema: z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"derivation.record">;
    payload: z.ZodObject<{
        derivationId: z.ZodString;
        taskId: z.ZodString;
        goalTerm: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            stepId: z.ZodString;
            ruleId: z.ZodString;
            ruleCategory: z.ZodEnum<{
                classical: "classical";
                comparison: "comparison";
                core: "core";
                "higher-order": "higher-order";
                logic: "logic";
                "meta-cognitive": "meta-cognitive";
                procedural: "procedural";
                propositional: "propositional";
                structural: "structural";
                temporal: "temporal";
                variable: "variable";
            }>;
            premises: z.ZodArray<z.ZodString>;
            conclusion: z.ZodString;
            truth: z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>;
            truthFn: z.ZodOptional<z.ZodString>;
            substitution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>>>;
            evidenceLineage: z.ZodArray<z.ZodString>;
            independence: z.ZodEnum<{
                dependent: "dependent";
                independent: "independent";
                unknown: "unknown";
            }>;
            cycle: z.ZodOptional<z.ZodNumber>;
            correlationId: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        finalTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        totalCycles: z.ZodNumber;
        maxDepthReached: z.ZodNumber;
        timestamp: z.ZodNumber;
        engine: z.ZodLiteral<"nar">;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const InputUserEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"input.user">;
    payload: z.ZodObject<{
        text: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DerivationMadeEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"derivation.made">;
    payload: z.ZodObject<{
        rule: z.ZodString;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        cpuMs: z.ZodOptional<z.ZodNumber>;
        lmCalls: z.ZodOptional<z.ZodNumber>;
        lmTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const AtomDerivedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.derived">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const AtomRetractedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.retracted">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BeliefAddedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.added">;
    payload: z.ZodObject<{
        term: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BeliefRetractedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.retracted">;
    payload: z.ZodObject<{
        term: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DriveChangedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"drive.changed">;
    payload: z.ZodObject<{
        drive: z.ZodString;
        urgency: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GoalAchievedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.achieved">;
    payload: z.ZodObject<{
        goal: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GoalFailedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.failed">;
    payload: z.ZodObject<{
        goal: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SkillExecutedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"skill.executed">;
    payload: z.ZodObject<{
        skill: z.ZodString;
        args: z.ZodArray<z.ZodString>;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ToolRequestEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.request">;
    payload: z.ZodObject<{
        toolName: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ToolResponseEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.response">;
    payload: z.ZodObject<{
        requestId: z.ZodString;
        toolName: z.ZodString;
        result: z.ZodOptional<z.ZodUnknown>;
        error: z.ZodOptional<z.ZodString>;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConfigSetEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.set">;
    payload: z.ZodObject<{
        path: z.ZodString;
        value: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConfigDeleteEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.delete">;
    payload: z.ZodObject<{
        path: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConfigSchemaEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.schema">;
    payload: z.ZodObject<{
        schema: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const KernelReadyEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"kernel.ready">;
    payload: z.ZodObject<{
        backendIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type KernelReadyEvent = z.infer<typeof KernelReadyEventSchema>;
export declare const BackendRegisteredEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"backend.registered">;
    payload: z.ZodObject<{
        manifest: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BootstrapEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"bootstrap">;
    payload: z.ZodObject<{
        beliefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        atoms: z.ZodOptional<z.ZodArray<z.ZodObject<{
            atom: z.ZodString;
            space: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            code: z.ZodString;
        }, z.core.$strip>>>;
        restored: z.ZodOptional<z.ZodObject<{
            cycleCount: z.ZodNumber;
            concepts: z.ZodNumber;
            pendingTasks: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const CycleEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"cycle">;
    cycle: z.ZodNumber;
    derived: z.ZodNumber;
    payload: z.ZodObject<{
        cycle: z.ZodNumber;
        derived: z.ZodNumber;
        state: z.ZodEnum<{
            paused: "paused";
            running: "running";
            stepping: "stepping";
        }>;
        phase: z.ZodString;
        activeTasks: z.ZodNumber;
        budget: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const HealthEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"health">;
    payload: z.ZodObject<{
        status: z.ZodEnum<{
            crashed: "crashed";
            degraded: "degraded";
            healthy: "healthy";
            stuck: "stuck";
        }>;
        cycleCount: z.ZodNumber;
        errorRate: z.ZodNumber;
        byEngine: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConflictDetectedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conflict:detected">;
    payload: z.ZodObject<{
        term: z.ZodString;
        conflictWith: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const MemoryPressureEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.pressure">;
    payload: z.ZodObject<{
        level: z.ZodNumber;
        utilization: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const MemoryConsolidatedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.consolidated">;
    payload: z.ZodObject<{
        conceptsRemoved: z.ZodNumber;
        conceptsArchived: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmCallEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.call">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmErrorEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.error">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        error: z.ZodString;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ErrorEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"error">;
    payload: z.ZodObject<{
        message: z.ZodString;
        context: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const NlAnalyzedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.analyzed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        intent: z.ZodString;
        entities: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const NlTranslationEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.translation">;
    payload: z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const NlClarificationNeededEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.clarification_needed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const NalDerivedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nal.derived">;
    payload: z.ZodObject<{
        term: z.ZodString;
        space: z.ZodString;
        truth: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmValidationFailedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.validation_failed">;
    payload: z.ZodObject<{
        reason: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const FeedbackCorrectionEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"feedback.correction">;
    payload: z.ZodObject<{
        original: z.ZodString;
        corrected: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const TurnStartEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.start">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        input: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const TurnEndEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.end">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        output: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const TurnErrorEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.error">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const StageStartEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.start">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const StageEndEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.end">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const StageErrorEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.error">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ClassifyResultEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"classify.result">;
    payload: z.ZodObject<{
        category: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const TriggerScoreEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"trigger.score">;
    payload: z.ZodObject<{
        trigger: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ReasoningStartEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.start">;
    payload: z.ZodObject<{
        query: z.ZodString;
        mode: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ReasoningEndEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.end">;
    payload: z.ZodObject<{
        query: z.ZodString;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmStartEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.start">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        prompt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmChunkEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.chunk">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        chunk: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmEndEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.end">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        response: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmSuggestsReasoningEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.suggests_reasoning">;
    payload: z.ZodObject<{
        suggestion: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmRuleExecutedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.executed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        input: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmRuleFailedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LmRuleDisabledEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.disabled">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DirectiveFoundEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.found">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DirectiveExecuteEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.execute">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DirectiveLoopRequestedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.loop_requested">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LoopPassEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"loop.pass">;
    payload: z.ZodObject<{
        pass: z.ZodNumber;
        actions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConversationMessageAddedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.message_added">;
    payload: z.ZodObject<{
        role: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConversationArtifactAddedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.artifact_added">;
    payload: z.ZodObject<{
        type: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConversationBeliefPinnedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.belief_pinned">;
    payload: z.ZodObject<{
        term: z.ZodString;
        pinned: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConversationSummarizedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.summarized">;
    payload: z.ZodObject<{
        summary: z.ZodString;
        messageCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleAppliedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.applied">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        result: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleSkippedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.skipped">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleStructuredEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.structured">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        schema: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleToolCalledEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_called">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleToolResultEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_result">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        result: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleFailedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleCircuitOpenEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleCircuitHalfOpenEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_half_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SystemLmRuleCircuitClosedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_closed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const NarEventSchemas: readonly [z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"input.user">;
    payload: z.ZodObject<{
        text: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"derivation.made">;
    payload: z.ZodObject<{
        rule: z.ZodString;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        cpuMs: z.ZodOptional<z.ZodNumber>;
        lmCalls: z.ZodOptional<z.ZodNumber>;
        lmTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.derived">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.retracted">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.added">;
    payload: z.ZodObject<{
        term: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.retracted">;
    payload: z.ZodObject<{
        term: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"drive.changed">;
    payload: z.ZodObject<{
        drive: z.ZodString;
        urgency: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.achieved">;
    payload: z.ZodObject<{
        goal: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.failed">;
    payload: z.ZodObject<{
        goal: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"skill.executed">;
    payload: z.ZodObject<{
        skill: z.ZodString;
        args: z.ZodArray<z.ZodString>;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.request">;
    payload: z.ZodObject<{
        toolName: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.response">;
    payload: z.ZodObject<{
        requestId: z.ZodString;
        toolName: z.ZodString;
        result: z.ZodOptional<z.ZodUnknown>;
        error: z.ZodOptional<z.ZodString>;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.set">;
    payload: z.ZodObject<{
        path: z.ZodString;
        value: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.delete">;
    payload: z.ZodObject<{
        path: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.schema">;
    payload: z.ZodObject<{
        schema: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"kernel.ready">;
    payload: z.ZodObject<{
        backendIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"backend.registered">;
    payload: z.ZodObject<{
        manifest: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"bootstrap">;
    payload: z.ZodObject<{
        beliefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        atoms: z.ZodOptional<z.ZodArray<z.ZodObject<{
            atom: z.ZodString;
            space: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            code: z.ZodString;
        }, z.core.$strip>>>;
        restored: z.ZodOptional<z.ZodObject<{
            cycleCount: z.ZodNumber;
            concepts: z.ZodNumber;
            pendingTasks: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"cycle">;
    cycle: z.ZodNumber;
    derived: z.ZodNumber;
    payload: z.ZodObject<{
        cycle: z.ZodNumber;
        derived: z.ZodNumber;
        state: z.ZodEnum<{
            paused: "paused";
            running: "running";
            stepping: "stepping";
        }>;
        phase: z.ZodString;
        activeTasks: z.ZodNumber;
        budget: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"health">;
    payload: z.ZodObject<{
        status: z.ZodEnum<{
            crashed: "crashed";
            degraded: "degraded";
            healthy: "healthy";
            stuck: "stuck";
        }>;
        cycleCount: z.ZodNumber;
        errorRate: z.ZodNumber;
        byEngine: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conflict:detected">;
    payload: z.ZodObject<{
        term: z.ZodString;
        conflictWith: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.pressure">;
    payload: z.ZodObject<{
        level: z.ZodNumber;
        utilization: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.consolidated">;
    payload: z.ZodObject<{
        conceptsRemoved: z.ZodNumber;
        conceptsArchived: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.call">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.error">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        error: z.ZodString;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"error">;
    payload: z.ZodObject<{
        message: z.ZodString;
        context: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.analyzed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        intent: z.ZodString;
        entities: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.translation">;
    payload: z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.clarification_needed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nal.derived">;
    payload: z.ZodObject<{
        term: z.ZodString;
        space: z.ZodString;
        truth: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.validation_failed">;
    payload: z.ZodObject<{
        reason: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"feedback.correction">;
    payload: z.ZodObject<{
        original: z.ZodString;
        corrected: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.start">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        input: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.end">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        output: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.error">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.start">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.end">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.error">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"classify.result">;
    payload: z.ZodObject<{
        category: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"trigger.score">;
    payload: z.ZodObject<{
        trigger: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.start">;
    payload: z.ZodObject<{
        query: z.ZodString;
        mode: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.end">;
    payload: z.ZodObject<{
        query: z.ZodString;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.start">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        prompt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.chunk">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        chunk: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.end">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        response: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.suggests_reasoning">;
    payload: z.ZodObject<{
        suggestion: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.executed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        input: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.disabled">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.found">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.execute">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.loop_requested">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"loop.pass">;
    payload: z.ZodObject<{
        pass: z.ZodNumber;
        actions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.message_added">;
    payload: z.ZodObject<{
        role: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.artifact_added">;
    payload: z.ZodObject<{
        type: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.belief_pinned">;
    payload: z.ZodObject<{
        term: z.ZodString;
        pinned: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.summarized">;
    payload: z.ZodObject<{
        summary: z.ZodString;
        messageCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.applied">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        result: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.skipped">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.structured">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        schema: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_called">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_result">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        result: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_half_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_closed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>];
export declare const ContentProposalSchema: z.ZodObject<{
    proposalId: z.ZodString;
    schemaVersion: z.ZodNumber;
    baseRevision: z.ZodNumber;
    cyclesPerProposal: z.ZodNumber;
    issuedAtCycle: z.ZodNumber;
    references: z.ZodArray<z.ZodString>;
    kind: z.ZodLiteral<"content">;
    payload: z.ZodObject<{
        taskType: any;
        term: z.ZodString;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const RuleProposalSchema: z.ZodObject<{
    proposalId: z.ZodString;
    schemaVersion: z.ZodNumber;
    baseRevision: z.ZodNumber;
    cyclesPerProposal: z.ZodNumber;
    issuedAtCycle: z.ZodNumber;
    references: z.ZodArray<z.ZodString>;
    kind: z.ZodLiteral<"rule">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        name: z.ZodString;
        pattern: z.ZodObject<{
            left: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            right: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
        truthFn: z.ZodString;
        priority: z.ZodNumber;
        body: z.ZodOptional<z.ZodString>;
        symbolicFallback: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProposalSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    proposalId: z.ZodString;
    schemaVersion: z.ZodNumber;
    baseRevision: z.ZodNumber;
    cyclesPerProposal: z.ZodNumber;
    issuedAtCycle: z.ZodNumber;
    references: z.ZodArray<z.ZodString>;
    kind: z.ZodLiteral<"content">;
    payload: z.ZodObject<{
        taskType: any;
        term: z.ZodString;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    proposalId: z.ZodString;
    schemaVersion: z.ZodNumber;
    baseRevision: z.ZodNumber;
    cyclesPerProposal: z.ZodNumber;
    issuedAtCycle: z.ZodNumber;
    references: z.ZodArray<z.ZodString>;
    kind: z.ZodLiteral<"rule">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        name: z.ZodString;
        pattern: z.ZodObject<{
            left: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            right: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
        truthFn: z.ZodString;
        priority: z.ZodNumber;
        body: z.ZodOptional<z.ZodString>;
        symbolicFallback: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>], "kind">;
export type ContentProposal = z.infer<typeof ContentProposalSchema>;
export type RuleProposal = z.infer<typeof RuleProposalSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export declare const ProposalRejectedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.rejected">;
    engine: z.ZodLiteral<"proposer">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        reason: z.ZodEnum<{
            cancelled: "cancelled";
            "evicted-reference": "evicted-reference";
            "failed-schema": "failed-schema";
            "queue-overflow": "queue-overflow";
            "schema-version": "schema-version";
            "stale-revision": "stale-revision";
        }>;
        detail: z.ZodString;
        observedRevision: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ProposalAdmittedEventSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.admitted">;
    engine: z.ZodLiteral<"proposer">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        schemaVersion: z.ZodNumber;
        baseRevision: z.ZodNumber;
        resultingRevision: z.ZodNumber;
        declaration: z.ZodOptional<z.ZodObject<{
            left: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            right: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            ruleId: z.ZodString;
            description: z.ZodString;
            truthFn: z.ZodString;
            body: z.ZodString;
            priority: z.ZodNumber;
            taskType: z.ZodOptional<z.ZodEnum<{
                [x: string]: any;
            }>>;
        }, z.core.$strip>>;
        producer: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ConsumedBudgetSchema: z.ZodObject<{
    cycles: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    memoryOps: z.ZodDefault<z.ZodNumber>;
    llmCalls: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ConsumedBudget = z.infer<typeof ConsumedBudgetSchema>;
export declare const TerminationReasonSchema: z.ZodEnum<{
    aborted: "aborted";
    backpressure: "backpressure";
    completed: "completed";
    "cycle-budget": "cycle-budget";
    deadline: "deadline";
    "depth-budget": "depth-budget";
    "llm-budget": "llm-budget";
    "memory-budget": "memory-budget";
}>;
export type TerminationReason = z.infer<typeof TerminationReasonSchema>;
export declare const zeroConsumed: () => ConsumedBudget;
export declare const ReasoningBudgetSchema: z.ZodObject<{
    maxCycles: z.ZodNumber;
    maxDepth: z.ZodNumber;
    maxMemoryOps: z.ZodNumber;
    maxLMCalls: z.ZodNumber;
    wallclockDeadlineMs: z.ZodOptional<z.ZodNumber>;
    abortSignal: z.ZodOptional<z.ZodUnknown>;
    terminationReason: z.ZodOptional<z.ZodEnum<{
        aborted: "aborted";
        backpressure: "backpressure";
        completed: "completed";
        "cycle-budget": "cycle-budget";
        deadline: "deadline";
        "depth-budget": "depth-budget";
        "llm-budget": "llm-budget";
        "memory-budget": "memory-budget";
    }>>;
    consumed: z.ZodDefault<z.ZodObject<{
        cycles: z.ZodDefault<z.ZodNumber>;
        depth: z.ZodDefault<z.ZodNumber>;
        memoryOps: z.ZodDefault<z.ZodNumber>;
        llmCalls: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;
export declare const BudgetGateInputSchema: z.ZodObject<{
    budget: z.ZodOptional<z.ZodObject<{
        maxCycles: z.ZodNumber;
        maxDepth: z.ZodNumber;
        maxMemoryOps: z.ZodNumber;
        maxLMCalls: z.ZodNumber;
        wallclockDeadlineMs: z.ZodOptional<z.ZodNumber>;
        abortSignal: z.ZodOptional<z.ZodUnknown>;
        terminationReason: z.ZodOptional<z.ZodEnum<{
            aborted: "aborted";
            backpressure: "backpressure";
            completed: "completed";
            "cycle-budget": "cycle-budget";
            deadline: "deadline";
            "depth-budget": "depth-budget";
            "llm-budget": "llm-budget";
            "memory-budget": "memory-budget";
        }>>;
        consumed: z.ZodDefault<z.ZodObject<{
            cycles: z.ZodDefault<z.ZodNumber>;
            depth: z.ZodDefault<z.ZodNumber>;
            memoryOps: z.ZodDefault<z.ZodNumber>;
            llmCalls: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    operation: z.ZodEnum<{
        "candidate-derivation": "candidate-derivation";
        "control-work": "control-work";
        "decision-derivation": "decision-derivation";
        derivation: "derivation";
        "derivation-depth": "derivation-depth";
        "lm-call": "lm-call";
        "memory-op": "memory-op";
        "nal-step": "nal-step";
        "premise-selection": "premise-selection";
        "proposal-application": "proposal-application";
        "systemone-judgment": "systemone-judgment";
    }>;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
    scopeId: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        "candidate-derivations": "candidate-derivations";
        "control-work": "control-work";
        "decision-derivations": "decision-derivations";
        derivations: "derivations";
        premises: "premises";
        "proposal-application": "proposal-application";
    }>, z.ZodString]>>;
    correlationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BudgetGateInput = z.infer<typeof BudgetGateInputSchema>;
export declare const BudgetGateOutputSchema: z.ZodObject<{
    granted: z.ZodBoolean;
    updatedBudget: z.ZodOptional<z.ZodObject<{
        maxCycles: z.ZodNumber;
        maxDepth: z.ZodNumber;
        maxMemoryOps: z.ZodNumber;
        maxLMCalls: z.ZodNumber;
        wallclockDeadlineMs: z.ZodOptional<z.ZodNumber>;
        abortSignal: z.ZodOptional<z.ZodUnknown>;
        terminationReason: z.ZodOptional<z.ZodEnum<{
            aborted: "aborted";
            backpressure: "backpressure";
            completed: "completed";
            "cycle-budget": "cycle-budget";
            deadline: "deadline";
            "depth-budget": "depth-budget";
            "llm-budget": "llm-budget";
            "memory-budget": "memory-budget";
        }>>;
        consumed: z.ZodDefault<z.ZodObject<{
            cycles: z.ZodDefault<z.ZodNumber>;
            depth: z.ZodDefault<z.ZodNumber>;
            memoryOps: z.ZodDefault<z.ZodNumber>;
            llmCalls: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    terminationReason: z.ZodOptional<z.ZodEnum<{
        aborted: "aborted";
        backpressure: "backpressure";
        completed: "completed";
        "cycle-budget": "cycle-budget";
        deadline: "deadline";
        "depth-budget": "depth-budget";
        "llm-budget": "llm-budget";
        "memory-budget": "memory-budget";
    }>>;
}, z.core.$strip>;
export type BudgetGateOutput = z.infer<typeof BudgetGateOutputSchema>;
export type GateName = 'perception' | 'action' | 'reward' | 'budget';
/** The decision shape: a grant, and why not when refused. */
export type Verdict<Granted extends string, Reason extends string = 'reason'> = {
    [K in Granted]: boolean;
} & {
    [K in Reason]?: string;
};
export type GateOutcome = Verdict<'granted'>;
export declare const PerceptionGateOutputSchema: z.ZodObject<{
    admitted: z.ZodBoolean;
    task: z.ZodOptional<z.ZodObject<{
        taskId: z.ZodString;
        term: z.ZodString;
        taskType: any;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodEnum<{
            derivation: "derivation";
            llm: "llm";
            reflex: "reflex";
            sensor: "sensor";
            user: "user";
        }>;
        budget: z.ZodObject<{
            priority: z.ZodNumber;
            durability: z.ZodNumber;
            quality: z.ZodNumber;
            cycles: z.ZodNumber;
            depth: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    rejectionReason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PerceptionGateOutput = z.infer<typeof PerceptionGateOutputSchema>;
export declare const CognitiveEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"task.admitted">;
    payload: z.ZodObject<{
        taskId: z.ZodString;
        term: z.ZodString;
        taskType: any;
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodEnum<{
            derivation: "derivation";
            llm: "llm";
            reflex: "reflex";
            sensor: "sensor";
            user: "user";
        }>;
        budget: z.ZodObject<{
            priority: z.ZodNumber;
            durability: z.ZodNumber;
            quality: z.ZodNumber;
            cycles: z.ZodNumber;
            depth: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"derivation.accepted">;
    payload: z.ZodObject<{
        derivationId: z.ZodString;
        ruleId: z.ZodString;
        ruleCategory: z.ZodOptional<z.ZodEnum<{
            classical: "classical";
            comparison: "comparison";
            core: "core";
            "higher-order": "higher-order";
            logic: "logic";
            "meta-cognitive": "meta-cognitive";
            procedural: "procedural";
            propositional: "propositional";
            structural: "structural";
            temporal: "temporal";
            variable: "variable";
        }>>;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>>;
        truthFn: z.ZodOptional<z.ZodString>;
        evidenceLineage: z.ZodArray<z.ZodString>;
        independenceCheck: z.ZodEnum<{
            dependent: "dependent";
            independent: "independent";
            unknown: "unknown";
        }>;
        cycle: z.ZodOptional<z.ZodNumber>;
        correlationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"derivation.record">;
    payload: z.ZodObject<{
        derivationId: z.ZodString;
        taskId: z.ZodString;
        goalTerm: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            stepId: z.ZodString;
            ruleId: z.ZodString;
            ruleCategory: z.ZodEnum<{
                classical: "classical";
                comparison: "comparison";
                core: "core";
                "higher-order": "higher-order";
                logic: "logic";
                "meta-cognitive": "meta-cognitive";
                procedural: "procedural";
                propositional: "propositional";
                structural: "structural";
                temporal: "temporal";
                variable: "variable";
            }>;
            premises: z.ZodArray<z.ZodString>;
            conclusion: z.ZodString;
            truth: z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>;
            truthFn: z.ZodOptional<z.ZodString>;
            substitution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            premiseTruths: z.ZodOptional<z.ZodArray<z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>>>;
            evidenceLineage: z.ZodArray<z.ZodString>;
            independence: z.ZodEnum<{
                dependent: "dependent";
                independent: "independent";
                unknown: "unknown";
            }>;
            cycle: z.ZodOptional<z.ZodNumber>;
            correlationId: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        finalTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        totalCycles: z.ZodNumber;
        maxDepthReached: z.ZodNumber;
        timestamp: z.ZodNumber;
        engine: z.ZodLiteral<"nar">;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"belief.revised">;
    payload: z.ZodObject<{
        term: z.ZodString;
        oldTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        newTruth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        evidenceLineage: z.ZodOptional<z.ZodArray<z.ZodString>>;
        revisionRule: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"concept.activated">;
    payload: z.ZodObject<{
        term: z.ZodString;
        priority: z.ZodNumber;
        activationSource: z.ZodOptional<z.ZodEnum<{
            associative: "associative";
            decay: "decay";
            derivation: "derivation";
            goal: "goal";
            perception: "perception";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"budget.exhausted">;
    payload: z.ZodObject<{
        budgetType: z.ZodEnum<{
            cycles: "cycles";
            depth: "depth";
            llm: "llm";
            memory: "memory";
        }>;
        remaining: z.ZodNumber;
        limit: z.ZodNumber;
        terminationReason: z.ZodEnum<{
            aborted: "aborted";
            backpressure: "backpressure";
            completed: "completed";
            "cycle-budget": "cycle-budget";
            deadline: "deadline";
            "depth-budget": "depth-budget";
            "llm-budget": "llm-budget";
            "memory-budget": "memory-budget";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"budget.consumed">;
    payload: z.ZodObject<{
        budgetType: z.ZodEnum<{
            cycles: "cycles";
            depth: "depth";
            llm: "llm";
            memory: "memory";
        }>;
        amount: z.ZodNumber;
        remaining: z.ZodNumber;
        limit: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"policy.violation">;
    payload: z.ZodObject<{
        policyId: z.ZodString;
        violationType: z.ZodEnum<{
            "budget-exceeded": "budget-exceeded";
            "epistemic-firewall": "epistemic-firewall";
            "sandbox-escape": "sandbox-escape";
            "self-mod-unauthorized": "self-mod-unauthorized";
            "unauthorized-tool": "unauthorized-tool";
        }>;
        detail: z.ZodString;
        severity: z.ZodEnum<{
            block: "block";
            quarantine: "quarantine";
            warn: "warn";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"autonomy.mode.changed">;
    payload: z.ZodObject<{
        previousMode: z.ZodEnum<{
            "human-approved-production": "human-approved-production";
            "low-risk-auto-merge": "low-risk-auto-merge";
            "observe-only": "observe-only";
            "propose-only": "propose-only";
            "sandbox-execute": "sandbox-execute";
        }>;
        newMode: z.ZodEnum<{
            "human-approved-production": "human-approved-production";
            "low-risk-auto-merge": "low-risk-auto-merge";
            "observe-only": "observe-only";
            "propose-only": "propose-only";
            "sandbox-execute": "sandbox-execute";
        }>;
        authorizedBy: z.ZodEnum<{
            "external-governance": "external-governance";
            human: "human";
            system: "system";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"self-mod.proposal">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        patchRef: z.ZodString;
        baseCommit: z.ZodString;
        patchDiff: z.ZodString;
        ciResults: z.ZodObject<{
            test: z.ZodBoolean;
            typecheck: z.ZodBoolean;
            lint: z.ZodBoolean;
            durationMs: z.ZodNumber;
        }, z.core.$strip>;
        riskSelfAssessment: z.ZodEnum<{
            HIGH: "HIGH";
            LOW: "LOW";
            MEDIUM: "MEDIUM";
        }>;
        affectedComponents: z.ZodArray<z.ZodEnum<{
            "approval-logic": "approval-logic";
            "autonomy-mode": "autonomy-mode";
            "cognitive-params": "cognitive-params";
            "kernel-gates": "kernel-gates";
            memory: "memory";
            other: "other";
            "reward-functions": "reward-functions";
            rules: "rules";
            "sandbox-config": "sandbox-config";
            tools: "tools";
        }>>;
        affectedFiles: z.ZodArray<z.ZodString>;
        linesAdded: z.ZodNumber;
        linesRemoved: z.ZodNumber;
        coverageDelta: z.ZodOptional<z.ZodNumber>;
        rationale: z.ZodString;
        timestamp: z.ZodNumber;
        agentSignature: z.ZodString;
        correlationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"judgment.resolved">;
    payload: z.ZodObject<{
        queryId: z.ZodString;
        shape: z.ZodString;
        axis: z.ZodString;
        backendId: z.ZodString;
        tier: z.ZodNumber;
        latencyMs: z.ZodNumber;
        entropy: z.ZodOptional<z.ZodNumber>;
        abstained: z.ZodBoolean;
        stampType: z.ZodEnum<{
            provisional: "provisional";
            standard: "standard";
        }>;
        calibrationVersion: z.ZodString;
        encoderDigest: z.ZodOptional<z.ZodString>;
        modelDigest: z.ZodOptional<z.ZodString>;
        calibrationDigest: z.ZodOptional<z.ZodString>;
        inputDigest: z.ZodOptional<z.ZodString>;
        decisionBand: z.ZodOptional<z.ZodUnknown>;
        cost: z.ZodObject<{
            tokensIn: z.ZodNumber;
            tokensOut: z.ZodNumber;
            computeMs: z.ZodNumber;
            memoryMb: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"gate.passed">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            action: "action";
            budget: "budget";
            perception: "perception";
            reward: "reward";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"gate.failed">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            action: "action";
            budget: "budget";
            perception: "perception";
            reward: "reward";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"egress.gate.rejected">;
    payload: z.ZodObject<{
        gate: z.ZodEnum<{
            groundedness: "groundedness";
            risk: "risk";
        }>;
        score: z.ZodOptional<z.ZodNumber>;
        detail: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"shadow.validation.dropped">;
    payload: z.ZodObject<{
        candidateTerm: z.ZodString;
        source: z.ZodEnum<{
            "bridge-llm": "bridge-llm";
            llm: "llm";
        }>;
        conflictType: z.ZodEnum<{
            frequency: "frequency";
            semantic: "semantic";
        }>;
        frequencyDelta: z.ZodOptional<z.ZodNumber>;
        semanticScore: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.submitted">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        revision: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.admitted">;
    engine: z.ZodLiteral<"proposer">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        schemaVersion: z.ZodNumber;
        baseRevision: z.ZodNumber;
        resultingRevision: z.ZodNumber;
        declaration: z.ZodOptional<z.ZodObject<{
            left: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            right: z.ZodObject<{
                op: z.ZodString;
            }, z.core.$strip>;
            ruleId: z.ZodString;
            description: z.ZodString;
            truthFn: z.ZodString;
            body: z.ZodString;
            priority: z.ZodNumber;
            taskType: z.ZodOptional<z.ZodEnum<{
                [x: string]: any;
            }>>;
        }, z.core.$strip>>;
        producer: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"proposal.rejected">;
    engine: z.ZodLiteral<"proposer">;
    payload: z.ZodObject<{
        proposalId: z.ZodString;
        kind: z.ZodEnum<{
            content: "content";
            rule: "rule";
        }>;
        reason: z.ZodEnum<{
            cancelled: "cancelled";
            "evicted-reference": "evicted-reference";
            "failed-schema": "failed-schema";
            "queue-overflow": "queue-overflow";
            "schema-version": "schema-version";
            "stale-revision": "stale-revision";
        }>;
        detail: z.ZodString;
        observedRevision: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"snapshot.created">;
    payload: z.ZodObject<{
        snapshotId: z.ZodString;
        cycle: z.ZodNumber;
        entryCount: z.ZodNumber;
        hash: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"snapshot.restored">;
    payload: z.ZodObject<{
        snapshotId: z.ZodString;
        cycle: z.ZodNumber;
        entriesReplayed: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"input.user">;
    payload: z.ZodObject<{
        text: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"derivation.made">;
    payload: z.ZodObject<{
        rule: z.ZodString;
        premises: z.ZodArray<z.ZodString>;
        conclusion: z.ZodString;
        cpuMs: z.ZodOptional<z.ZodNumber>;
        lmCalls: z.ZodOptional<z.ZodNumber>;
        lmTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.derived">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"atom.retracted">;
    payload: z.ZodObject<{
        atom: z.ZodString;
        space: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.added">;
    payload: z.ZodObject<{
        term: z.ZodString;
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"belief.retracted">;
    payload: z.ZodObject<{
        term: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"drive.changed">;
    payload: z.ZodObject<{
        drive: z.ZodString;
        urgency: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.achieved">;
    payload: z.ZodObject<{
        goal: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"goal.failed">;
    payload: z.ZodObject<{
        goal: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"skill.executed">;
    payload: z.ZodObject<{
        skill: z.ZodString;
        args: z.ZodArray<z.ZodString>;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.request">;
    payload: z.ZodObject<{
        toolName: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"tool.response">;
    payload: z.ZodObject<{
        requestId: z.ZodString;
        toolName: z.ZodString;
        result: z.ZodOptional<z.ZodUnknown>;
        error: z.ZodOptional<z.ZodString>;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.set">;
    payload: z.ZodObject<{
        path: z.ZodString;
        value: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.delete">;
    payload: z.ZodObject<{
        path: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"config.schema">;
    payload: z.ZodObject<{
        schema: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"kernel.ready">;
    payload: z.ZodObject<{
        backendIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"backend.registered">;
    payload: z.ZodObject<{
        manifest: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"bootstrap">;
    payload: z.ZodObject<{
        beliefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        atoms: z.ZodOptional<z.ZodArray<z.ZodObject<{
            atom: z.ZodString;
            space: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            code: z.ZodString;
        }, z.core.$strip>>>;
        restored: z.ZodOptional<z.ZodObject<{
            cycleCount: z.ZodNumber;
            concepts: z.ZodNumber;
            pendingTasks: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"cycle">;
    cycle: z.ZodNumber;
    derived: z.ZodNumber;
    payload: z.ZodObject<{
        cycle: z.ZodNumber;
        derived: z.ZodNumber;
        state: z.ZodEnum<{
            paused: "paused";
            running: "running";
            stepping: "stepping";
        }>;
        phase: z.ZodString;
        activeTasks: z.ZodNumber;
        budget: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"health">;
    payload: z.ZodObject<{
        status: z.ZodEnum<{
            crashed: "crashed";
            degraded: "degraded";
            healthy: "healthy";
            stuck: "stuck";
        }>;
        cycleCount: z.ZodNumber;
        errorRate: z.ZodNumber;
        byEngine: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conflict:detected">;
    payload: z.ZodObject<{
        term: z.ZodString;
        conflictWith: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.pressure">;
    payload: z.ZodObject<{
        level: z.ZodNumber;
        utilization: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"memory.consolidated">;
    payload: z.ZodObject<{
        conceptsRemoved: z.ZodNumber;
        conceptsArchived: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.call">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.error">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        error: z.ZodString;
        duration: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"error">;
    payload: z.ZodObject<{
        message: z.ZodString;
        context: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.analyzed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        intent: z.ZodString;
        entities: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.translation">;
    payload: z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nl.clarification_needed">;
    payload: z.ZodObject<{
        text: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"nal.derived">;
    payload: z.ZodObject<{
        term: z.ZodString;
        space: z.ZodString;
        truth: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.validation_failed">;
    payload: z.ZodObject<{
        reason: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"feedback.correction">;
    payload: z.ZodObject<{
        original: z.ZodString;
        corrected: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.start">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        input: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.end">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        output: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"turn.error">;
    payload: z.ZodObject<{
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.start">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.end">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"stage.error">;
    payload: z.ZodObject<{
        stage: z.ZodString;
        turnId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"classify.result">;
    payload: z.ZodObject<{
        category: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"trigger.score">;
    payload: z.ZodObject<{
        trigger: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.start">;
    payload: z.ZodObject<{
        query: z.ZodString;
        mode: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"reasoning.end">;
    payload: z.ZodObject<{
        query: z.ZodString;
        result: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.start">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        prompt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.chunk">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        chunk: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.end">;
    payload: z.ZodObject<{
        modelId: z.ZodString;
        response: z.ZodString;
        durationMs: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm.suggests_reasoning">;
    payload: z.ZodObject<{
        suggestion: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.executed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        input: z.ZodString;
        output: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"lm_rule.disabled">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.found">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.execute">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"directive.loop_requested">;
    payload: z.ZodObject<{
        directive: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"loop.pass">;
    payload: z.ZodObject<{
        pass: z.ZodNumber;
        actions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.message_added">;
    payload: z.ZodObject<{
        role: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.artifact_added">;
    payload: z.ZodObject<{
        type: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.belief_pinned">;
    payload: z.ZodObject<{
        term: z.ZodString;
        pinned: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"conversation.summarized">;
    payload: z.ZodObject<{
        summary: z.ZodString;
        messageCount: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.applied">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        result: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.skipped">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.structured">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        schema: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_called">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        args: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.tool_result">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        tool: z.ZodString;
        result: z.ZodUnknown;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.failed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_half_open">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    timestamp: z.ZodNumber;
    correlationId: z.ZodString;
    causationId: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    engine: z.ZodLiteral<"nar">;
    type: z.ZodLiteral<"system_lm_rule.circuit_closed">;
    payload: z.ZodObject<{
        ruleId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;
export type TaskAdmittedEvent = z.infer<typeof TaskAdmittedEventSchema>;
export type DerivationAcceptedEvent = z.infer<typeof DerivationAcceptedEventSchema>;
export type DerivationRecordEvent = z.infer<typeof DerivationRecordEventSchema>;
export type BeliefRevisedEvent = z.infer<typeof BeliefRevisedEventSchema>;
export type ConceptActivatedEvent = z.infer<typeof ConceptActivatedEventSchema>;
export type BudgetExhaustedEvent = z.infer<typeof BudgetExhaustedEventSchema>;
export type BudgetConsumedEvent = z.infer<typeof BudgetConsumedEventSchema>;
export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;
export type AutonomyModeChangedEvent = z.infer<typeof AutonomyModeChangedEventSchema>;
export type SelfModProposalEvent = z.infer<typeof SelfModProposalEventSchema>;
export type GatePassedEvent = z.infer<typeof GatePassedEventSchema>;
export type GateFailedEvent = z.infer<typeof GateFailedEventSchema>;
export type EgressGateRejectedEvent = z.infer<typeof EgressGateRejectedEventSchema>;
export type ShadowValidationDropEvent = z.infer<typeof ShadowValidationDropEventSchema>;
export type ProposalSubmittedEvent = z.infer<typeof ProposalSubmittedEventSchema>;
export type ProposalAdmittedEvent = z.infer<typeof ProposalAdmittedEventSchema>;
export type ProposalRejectedEvent = z.infer<typeof ProposalRejectedEventSchema>;
export type SnapshotCreatedEvent = z.infer<typeof SnapshotCreatedEventSchema>;
export type SnapshotRestoredEvent = z.infer<typeof SnapshotRestoredEventSchema>;
export type InputUserEvent = z.infer<typeof InputUserEventSchema>;
export type DerivationMadeEvent = z.infer<typeof DerivationMadeEventSchema>;
export type AtomDerivedEvent = z.infer<typeof AtomDerivedEventSchema>;
export type AtomRetractedEvent = z.infer<typeof AtomRetractedEventSchema>;
export type BeliefAddedEvent = z.infer<typeof BeliefAddedEventSchema>;
export type BeliefRetractedEvent = z.infer<typeof BeliefRetractedEventSchema>;
export type GoalAchievedEvent = z.infer<typeof GoalAchievedEventSchema>;
export type GoalFailedEvent = z.infer<typeof GoalFailedEventSchema>;
export type SkillExecutedEvent = z.infer<typeof SkillExecutedEventSchema>;
export type ToolRequestEvent = z.infer<typeof ToolRequestEventSchema>;
export type ToolResponseEvent = z.infer<typeof ToolResponseEventSchema>;
export type ConflictDetectedEvent = z.infer<typeof ConflictDetectedEventSchema>;
export type ConfigDeleteEvent = z.infer<typeof ConfigDeleteEventSchema>;
export type ConfigSchemaEvent = z.infer<typeof ConfigSchemaEventSchema>;
export type ConfigSetEvent = z.infer<typeof ConfigSetEventSchema>;
export type BootstrapEvent = z.infer<typeof BootstrapEventSchema>;
export type CycleEvent = z.infer<typeof CycleEventSchema>;
export type HealthEvent = z.infer<typeof HealthEventSchema>;
export type DriveChangedEvent = z.infer<typeof DriveChangedEventSchema>;
export type BackendRegisteredEvent = z.infer<typeof BackendRegisteredEventSchema>;
export type CognitiveEventOf<T extends CognitiveEvent['type']> = Extract<CognitiveEvent, {
    type: T;
}>;
export declare const validateCognitiveEvent: (data: unknown) => {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "task.admitted";
    payload: {
        [x: string]: any;
        taskId: string;
        term: string;
        truth?: {
            frequency: number;
            confidence: number;
        } | undefined;
        source: "derivation" | "llm" | "reflex" | "sensor" | "user";
        budget: {
            priority: number;
            durability: number;
            quality: number;
            cycles: number;
            depth: number;
        };
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "derivation.accepted";
    payload: {
        derivationId: string;
        ruleId: string;
        ruleCategory?: "classical" | "comparison" | "core" | "higher-order" | "logic" | "meta-cognitive" | "procedural" | "propositional" | "structural" | "temporal" | "variable" | undefined;
        premises: string[];
        conclusion: string;
        truth: {
            frequency: number;
            confidence: number;
        };
        premiseTruths?: {
            frequency: number;
            confidence: number;
        }[] | undefined;
        truthFn?: string | undefined;
        evidenceLineage: string[];
        independenceCheck: "dependent" | "independent" | "unknown";
        cycle?: number | undefined;
        correlationId?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "derivation.record";
    payload: {
        derivationId: string;
        taskId: string;
        goalTerm: string;
        steps: {
            stepId: string;
            ruleId: string;
            ruleCategory: "classical" | "comparison" | "core" | "higher-order" | "logic" | "meta-cognitive" | "procedural" | "propositional" | "structural" | "temporal" | "variable";
            premises: string[];
            conclusion: string;
            truth: {
                frequency: number;
                confidence: number;
            };
            truthFn?: string | undefined;
            substitution?: Record<string, string> | undefined;
            premiseTruths?: {
                frequency: number;
                confidence: number;
            }[] | undefined;
            evidenceLineage: string[];
            independence: "dependent" | "independent" | "unknown";
            cycle?: number | undefined;
            correlationId?: string | undefined;
            timestamp?: number | undefined;
        }[];
        finalTruth: {
            frequency: number;
            confidence: number;
        };
        totalCycles: number;
        maxDepthReached: number;
        timestamp: number;
        engine: "nar";
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "belief.revised";
    payload: {
        term: string;
        oldTruth: {
            frequency: number;
            confidence: number;
        };
        newTruth: {
            frequency: number;
            confidence: number;
        };
        evidenceLineage?: string[] | undefined;
        revisionRule?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "concept.activated";
    payload: {
        term: string;
        priority: number;
        activationSource?: "associative" | "decay" | "derivation" | "goal" | "perception" | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "budget.exhausted";
    payload: {
        budgetType: "cycles" | "depth" | "llm" | "memory";
        remaining: number;
        limit: number;
        terminationReason: "aborted" | "backpressure" | "completed" | "cycle-budget" | "deadline" | "depth-budget" | "llm-budget" | "memory-budget";
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "budget.consumed";
    payload: {
        budgetType: "cycles" | "depth" | "llm" | "memory";
        amount: number;
        remaining: number;
        limit: number;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "policy.violation";
    payload: {
        policyId: string;
        violationType: "budget-exceeded" | "epistemic-firewall" | "sandbox-escape" | "self-mod-unauthorized" | "unauthorized-tool";
        detail: string;
        severity: "block" | "quarantine" | "warn";
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "autonomy.mode.changed";
    payload: {
        previousMode: "human-approved-production" | "low-risk-auto-merge" | "observe-only" | "propose-only" | "sandbox-execute";
        newMode: "human-approved-production" | "low-risk-auto-merge" | "observe-only" | "propose-only" | "sandbox-execute";
        authorizedBy: "external-governance" | "human" | "system";
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "self-mod.proposal";
    payload: {
        proposalId: string;
        patchRef: string;
        baseCommit: string;
        patchDiff: string;
        ciResults: {
            test: boolean;
            typecheck: boolean;
            lint: boolean;
            durationMs: number;
        };
        riskSelfAssessment: "HIGH" | "LOW" | "MEDIUM";
        affectedComponents: ("approval-logic" | "autonomy-mode" | "cognitive-params" | "kernel-gates" | "memory" | "other" | "reward-functions" | "rules" | "sandbox-config" | "tools")[];
        affectedFiles: string[];
        linesAdded: number;
        linesRemoved: number;
        coverageDelta?: number | undefined;
        rationale: string;
        timestamp: number;
        agentSignature: string;
        correlationId?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "judgment.resolved";
    payload: {
        queryId: string;
        shape: string;
        axis: string;
        backendId: string;
        tier: number;
        latencyMs: number;
        entropy?: number | undefined;
        abstained: boolean;
        stampType: "provisional" | "standard";
        calibrationVersion: string;
        encoderDigest?: string | undefined;
        modelDigest?: string | undefined;
        calibrationDigest?: string | undefined;
        inputDigest?: string | undefined;
        decisionBand?: unknown;
        cost: {
            tokensIn: number;
            tokensOut: number;
            computeMs: number;
            memoryMb: number;
        };
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "gate.passed";
    payload: {
        gate: "action" | "budget" | "perception" | "reward";
        score?: number | undefined;
        detail?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "gate.failed";
    payload: {
        gate: "action" | "budget" | "perception" | "reward";
        score?: number | undefined;
        detail?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "egress.gate.rejected";
    payload: {
        gate: "groundedness" | "risk";
        score?: number | undefined;
        detail?: string | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "shadow.validation.dropped";
    payload: {
        candidateTerm: string;
        source: "bridge-llm" | "llm";
        conflictType: "frequency" | "semantic";
        frequencyDelta?: number | undefined;
        semanticScore?: number | undefined;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "proposal.submitted";
    payload: {
        proposalId: string;
        kind: "content" | "rule";
        revision: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "proposal.admitted";
    engine: "proposer";
    payload: {
        proposalId: string;
        kind: "content" | "rule";
        schemaVersion: number;
        baseRevision: number;
        resultingRevision: number;
        declaration?: {
            left: {
                op: string;
            };
            right: {
                op: string;
            };
            ruleId: string;
            description: string;
            truthFn: string;
            body: string;
            priority: number;
            taskType?: z.ZodOptional<z.ZodEnum<{
                [x: string]: any;
            }>>;
        } | undefined;
        producer?: string | undefined;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "proposal.rejected";
    engine: "proposer";
    payload: {
        proposalId: string;
        kind: "content" | "rule";
        reason: "cancelled" | "evicted-reference" | "failed-schema" | "queue-overflow" | "schema-version" | "stale-revision";
        detail: string;
        observedRevision: number;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "snapshot.created";
    payload: {
        snapshotId: string;
        cycle: number;
        entryCount: number;
        hash: string;
    };
} | {
    engine: z.ZodEnum<{
        [x: string]: any;
    }>;
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    type: "snapshot.restored";
    payload: {
        snapshotId: string;
        cycle: number;
        entriesReplayed: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "input.user";
    payload: {
        text: string;
        source: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "derivation.made";
    payload: {
        rule: string;
        premises: string[];
        conclusion: string;
        cpuMs?: number | undefined;
        lmCalls?: number | undefined;
        lmTokens?: number | undefined;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "atom.derived";
    payload: {
        atom: string;
        space: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "atom.retracted";
    payload: {
        atom: string;
        space: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "belief.added";
    payload: {
        term: string;
        truth: {
            frequency: number;
            confidence: number;
        };
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "belief.retracted";
    payload: {
        term: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "drive.changed";
    payload: {
        drive: string;
        urgency: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "goal.achieved";
    payload: {
        goal: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "goal.failed";
    payload: {
        goal: string;
        reason: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "skill.executed";
    payload: {
        skill: string;
        args: string[];
        result: string;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "tool.request";
    payload: {
        toolName: string;
        args: Record<string, unknown>;
        timeoutMs?: number | undefined;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "tool.response";
    payload: {
        requestId: string;
        toolName: string;
        result?: unknown;
        error?: string | undefined;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "config.set";
    payload: {
        path: string;
        value: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "config.delete";
    payload: {
        path: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "config.schema";
    payload: {
        schema: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "kernel.ready";
    payload: {
        backendIds: string[];
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "backend.registered";
    payload: {
        manifest: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "bootstrap";
    payload: {
        beliefs?: string[] | undefined;
        atoms?: {
            atom: string;
            space?: string | undefined;
        }[] | undefined;
        skills?: {
            name: string;
            code: string;
        }[] | undefined;
        restored?: {
            cycleCount: number;
            concepts: number;
            pendingTasks: number;
        } | undefined;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "cycle";
    cycle: number;
    derived: number;
    payload: {
        cycle: number;
        derived: number;
        state: "paused" | "running" | "stepping";
        phase: string;
        activeTasks: number;
        budget: Record<string, number>;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "health";
    payload: {
        status: "crashed" | "degraded" | "healthy" | "stuck";
        cycleCount: number;
        errorRate: number;
        byEngine?: Record<string, number> | undefined;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "conflict:detected";
    payload: {
        term: string;
        conflictWith: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "memory.pressure";
    payload: {
        level: number;
        utilization: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "memory.consolidated";
    payload: {
        conceptsRemoved: number;
        conceptsArchived: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.call";
    payload: {
        modelId: string;
        inputTokens: number;
        outputTokens: number;
        duration: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.error";
    payload: {
        modelId: string;
        error: string;
        duration: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "error";
    payload: {
        message: string;
        context?: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "nl.analyzed";
    payload: {
        text: string;
        intent: string;
        entities: string[];
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "nl.translation";
    payload: {
        source: string;
        target: string;
        confidence: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "nl.clarification_needed";
    payload: {
        text: string;
        reason: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "nal.derived";
    payload: {
        term: string;
        space: string;
        truth: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.validation_failed";
    payload: {
        reason: string;
        output: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "feedback.correction";
    payload: {
        original: string;
        corrected: string;
        source: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "turn.start";
    payload: {
        turnId: string;
        input: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "turn.end";
    payload: {
        turnId: string;
        output: string;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "turn.error";
    payload: {
        turnId: string;
        error: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "stage.start";
    payload: {
        stage: string;
        turnId: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "stage.end";
    payload: {
        stage: string;
        turnId: string;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "stage.error";
    payload: {
        stage: string;
        turnId: string;
        error: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "classify.result";
    payload: {
        category: string;
        confidence: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "trigger.score";
    payload: {
        trigger: string;
        score: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "reasoning.start";
    payload: {
        query: string;
        mode: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "reasoning.end";
    payload: {
        query: string;
        result: string;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.start";
    payload: {
        modelId: string;
        prompt: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.chunk";
    payload: {
        modelId: string;
        chunk: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.end";
    payload: {
        modelId: string;
        response: string;
        durationMs: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm.suggests_reasoning";
    payload: {
        suggestion: string;
        confidence: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm_rule.executed";
    payload: {
        ruleId: string;
        input: string;
        output: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm_rule.failed";
    payload: {
        ruleId: string;
        error: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "lm_rule.disabled";
    payload: {
        ruleId: string;
        reason: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "directive.found";
    payload: {
        directive: string;
        target: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "directive.execute";
    payload: {
        directive: string;
        args: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "directive.loop_requested";
    payload: {
        directive: string;
        reason: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "loop.pass";
    payload: {
        pass: number;
        actions: string[];
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "conversation.message_added";
    payload: {
        role: string;
        content: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "conversation.artifact_added";
    payload: {
        type: string;
        content: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "conversation.belief_pinned";
    payload: {
        term: string;
        pinned: boolean;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "conversation.summarized";
    payload: {
        summary: string;
        messageCount: number;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.applied";
    payload: {
        ruleId: string;
        result: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.skipped";
    payload: {
        ruleId: string;
        reason: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.structured";
    payload: {
        ruleId: string;
        schema: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.tool_called";
    payload: {
        ruleId: string;
        tool: string;
        args: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.tool_result";
    payload: {
        ruleId: string;
        tool: string;
        result: unknown;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.failed";
    payload: {
        ruleId: string;
        error: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.circuit_open";
    payload: {
        ruleId: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.circuit_half_open";
    payload: {
        ruleId: string;
    };
} | {
    timestamp: number;
    correlationId: string;
    causationId?: string | undefined;
    id?: string | undefined;
    engine: "nar";
    type: "system_lm_rule.circuit_closed";
    payload: {
        ruleId: string;
    };
};
export declare const validateProposal: (data: unknown) => {
    proposalId: string;
    schemaVersion: number;
    baseRevision: number;
    cyclesPerProposal: number;
    issuedAtCycle: number;
    references: string[];
    kind: "content";
    payload: {
        [x: string]: any;
        term: string;
        truth?: {
            frequency: number;
            confidence: number;
        } | undefined;
    };
} | {
    proposalId: string;
    schemaVersion: number;
    baseRevision: number;
    cyclesPerProposal: number;
    issuedAtCycle: number;
    references: string[];
    kind: "rule";
    payload: {
        ruleId: string;
        name: string;
        pattern: {
            left: {
                op: string;
            };
            right: {
                op: string;
            };
        };
        truthFn: string;
        priority: number;
        body?: string | undefined;
        symbolicFallback?: string | undefined;
    };
};
export declare const validateFormalizationCandidate: (data: unknown) => {
    candidateId: string;
    narsese: string;
    taskType: z.ZodEnum<{
        [x: string]: any;
    }>;
    truth?: {
        frequency: number;
        confidence: number;
    } | undefined;
    confidence: number;
    sourceSpans: {
        start: number;
        end: number;
        text: string;
    }[];
    ambiguityFlags: {
        type: "intent" | "modal" | "negation" | "parse" | "quantifier" | "reference" | "temporal" | "term";
        description: string;
        options: string[];
        confidence: number;
        severity: "high" | "low" | "medium";
    }[];
    metadata?: {
        model?: string | undefined;
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        latencyMs?: number | undefined;
    } | undefined;
};
export declare const validateFormalizationBatch: (data: unknown) => {
    batchId: string;
    sourceText: string;
    candidates: {
        candidateId: string;
        narsese: string;
        taskType: z.ZodEnum<{
            [x: string]: any;
        }>;
        truth?: {
            frequency: number;
            confidence: number;
        } | undefined;
        confidence: number;
        sourceSpans: {
            start: number;
            end: number;
            text: string;
        }[];
        ambiguityFlags: {
            type: "intent" | "modal" | "negation" | "parse" | "quantifier" | "reference" | "temporal" | "term";
            description: string;
            options: string[];
            confidence: number;
            severity: "high" | "low" | "medium";
        }[];
        metadata?: {
            model?: string | undefined;
            promptTokens?: number | undefined;
            completionTokens?: number | undefined;
            latencyMs?: number | undefined;
        } | undefined;
    }[];
    detectedIntent?: "chat" | "command" | "learning" | "reasoning" | undefined;
    globalAmbiguities?: {
        type: "intent" | "modal" | "negation" | "parse" | "quantifier" | "reference" | "temporal" | "term";
        description: string;
        options: string[];
        confidence: number;
        severity: "high" | "low" | "medium";
    }[] | undefined;
};
export declare const validateDerivationRecord: (data: unknown) => {
    derivationId: string;
    taskId: string;
    goalTerm: string;
    steps: {
        stepId: string;
        ruleId: string;
        ruleCategory: "classical" | "comparison" | "core" | "higher-order" | "logic" | "meta-cognitive" | "procedural" | "propositional" | "structural" | "temporal" | "variable";
        premises: string[];
        conclusion: string;
        truth: {
            frequency: number;
            confidence: number;
        };
        truthFn?: string | undefined;
        substitution?: Record<string, string> | undefined;
        premiseTruths?: {
            frequency: number;
            confidence: number;
        }[] | undefined;
        evidenceLineage: string[];
        independence: "dependent" | "independent" | "unknown";
        cycle?: number | undefined;
        correlationId?: string | undefined;
        timestamp?: number | undefined;
    }[];
    finalTruth: {
        frequency: number;
        confidence: number;
    };
    totalCycles: number;
    maxDepthReached: number;
    timestamp: number;
    engine: "nar";
};
export declare const validateReasoningBudget: (data: unknown) => {
    maxCycles: number;
    maxDepth: number;
    maxMemoryOps: number;
    maxLMCalls: number;
    wallclockDeadlineMs?: number | undefined;
    abortSignal?: unknown;
    terminationReason?: "aborted" | "backpressure" | "completed" | "cycle-budget" | "deadline" | "depth-budget" | "llm-budget" | "memory-budget" | undefined;
    consumed: {
        cycles: number;
        depth: number;
        memoryOps: number;
        llmCalls: number;
    };
};
export declare const validateRuleTable: (data: unknown) => {
    schemaVersion: number;
    artifactVersion: string;
    revision: number;
    entries: {
        left: {
            op: string;
        };
        right: {
            op: string;
        };
        ruleId: string;
        description: string;
        truthFn: string;
        body: string;
        priority: number;
        taskType?: z.ZodOptional<z.ZodEnum<{
            [x: string]: any;
        }>>;
        artifactVersion: string;
        ruleSetRevision: number;
        parentRevision: number | null;
        ruleSchemaVersion: number;
        provenance: {
            kind: "builtin";
        } | {
            kind: "proposal";
            proposalId: string;
            producer?: string | undefined;
        } | {
            kind: "import";
            source: string;
        };
        eventId?: string | undefined;
    }[];
};
export declare const DURABLE_EVENT_TYPES: Set<"atom.derived" | "atom.retracted" | "autonomy.mode.changed" | "belief.added" | "belief.retracted" | "belief.revised" | "bootstrap" | "budget.exhausted" | "conflict:detected" | "derivation.accepted" | "derivation.record" | "egress.gate.rejected" | "goal.achieved" | "goal.failed" | "policy.violation" | "proposal.admitted" | "proposal.rejected" | "self-mod.proposal" | "shadow.validation.dropped" | "skill.executed" | "task.admitted" | "tool.response">;
export declare const RECALLED_EVENT_TYPES: Set<"autonomy.mode.changed" | "belief.added" | "belief.retracted" | "belief.revised" | "budget.exhausted" | "conflict:detected" | "derivation.accepted" | "goal.achieved" | "goal.failed" | "input.user" | "policy.violation" | "skill.executed" | "task.admitted" | "tool.request" | "tool.response">;
export declare const isDurableEvent: (event: {
    type: string;
}) => boolean;
export declare const recalledEventTypes: () => string[];
export declare const permitsExecution: (mode: AutonomyMode) => boolean;
export declare const riskLevelOf: (risk: "low" | "medium" | "high") => "LOW" | "MEDIUM" | "HIGH";
export declare const isNarEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    engine: 'nar';
}>;
export declare const isEventType: <T extends CognitiveEvent['type']>(type: T) => (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: T;
}>;
type Mintable<T extends CognitiveEvent['type']> = Omit<CognitiveEventOf<T>, 'type' | 'engine' | 'timestamp' | 'correlationId' | 'causationId'> & {
    engine: CognitiveEvent['engine'];
    timestamp?: number;
    correlationId?: string;
    causationId?: string;
};
export declare const mintCognitiveEvent: <T extends CognitiveEvent['type']>(type: T, draft: Mintable<T>) => CognitiveEventOf<T>;
export {};
//# sourceMappingURL=schemas.d.ts.map