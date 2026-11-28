import { z } from 'zod';
export declare const EvidenceRefSchema: z.ZodObject<{
    type: z.ZodEnum<{
        cast: "cast";
        event: "event";
        frame: "frame";
        mark: "mark";
    }>;
    id: z.ZodString;
    timestamp: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export declare const FindingKindSchema: z.ZodEnum<{
    "broken-ui": "broken-ui";
    loop: "loop";
    "narration-divergence": "narration-divergence";
    stalled: "stalled";
    "unmet-expectation": "unmet-expectation";
    "wrong-output": "wrong-output";
}>;
export type FindingKind = z.infer<typeof FindingKindSchema>;
export declare const FindingSeveritySchema: z.ZodEnum<{
    fail: "fail";
    info: "info";
    uncertain: "uncertain";
    warn: "warn";
}>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export declare const FindingSchema: z.ZodObject<{
    id: z.ZodString;
    signature: z.ZodString;
    kind: z.ZodEnum<{
        "broken-ui": "broken-ui";
        loop: "loop";
        "narration-divergence": "narration-divergence";
        stalled: "stalled";
        "unmet-expectation": "unmet-expectation";
        "wrong-output": "wrong-output";
    }>;
    severity: z.ZodEnum<{
        fail: "fail";
        info: "info";
        uncertain: "uncertain";
        warn: "warn";
    }>;
    claim: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            cast: "cast";
            event: "event";
            frame: "frame";
            mark: "mark";
        }>;
        id: z.ZodString;
        timestamp: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    markId: z.ZodOptional<z.ZodString>;
    expectationId: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodString>;
    repairHint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Finding = z.infer<typeof FindingSchema>;
export declare const VerdictOverallSchema: z.ZodEnum<{
    fail: "fail";
    pass: "pass";
    uncertain: "uncertain";
    warn: "warn";
}>;
export type VerdictOverall = z.infer<typeof VerdictOverallSchema>;
export declare const VerdictSchema: z.ZodObject<{
    runId: z.ZodString;
    programId: z.ZodString;
    overall: z.ZodEnum<{
        fail: "fail";
        pass: "pass";
        uncertain: "uncertain";
        warn: "warn";
    }>;
    perception: z.ZodEnum<{
        text: "text";
        unavailable: "unavailable";
        vlm: "vlm";
    }>;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        signature: z.ZodString;
        kind: z.ZodEnum<{
            "broken-ui": "broken-ui";
            loop: "loop";
            "narration-divergence": "narration-divergence";
            stalled: "stalled";
            "unmet-expectation": "unmet-expectation";
            "wrong-output": "wrong-output";
        }>;
        severity: z.ZodEnum<{
            fail: "fail";
            info: "info";
            uncertain: "uncertain";
            warn: "warn";
        }>;
        claim: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                cast: "cast";
                event: "event";
                frame: "frame";
                mark: "mark";
            }>;
            id: z.ZodString;
            timestamp: z.ZodNumber;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        markId: z.ZodOptional<z.ZodString>;
        expectationId: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodString>;
        repairHint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Verdict = z.infer<typeof VerdictSchema>;
export declare const CheckKindSchema: z.ZodEnum<{
    budget: "budget";
    literal: "literal";
    stall: "stall";
    ui: "ui";
    validator: "validator";
}>;
export type CheckKind = z.infer<typeof CheckKindSchema>;
export declare const CheckResultSchema: z.ZodObject<{
    checkId: z.ZodString;
    kind: z.ZodEnum<{
        budget: "budget";
        literal: "literal";
        stall: "stall";
        ui: "ui";
        validator: "validator";
    }>;
    passed: z.ZodBoolean;
    score: z.ZodNumber;
    details: z.ZodString;
    expectationId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CheckResult = z.infer<typeof CheckResultSchema>;
export declare const RepairTaskSchema: z.ZodObject<{
    taskId: z.ZodString;
    baselineRunId: z.ZodString;
    baselineGitSha: z.ZodString;
    program: z.ZodAny;
    seed: z.ZodString;
    lane: z.ZodEnum<{
        hermetic: "hermetic";
        live: "live";
    }>;
    repro: z.ZodString;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        signature: z.ZodString;
        kind: z.ZodEnum<{
            "broken-ui": "broken-ui";
            loop: "loop";
            "narration-divergence": "narration-divergence";
            stalled: "stalled";
            "unmet-expectation": "unmet-expectation";
            "wrong-output": "wrong-output";
        }>;
        severity: z.ZodEnum<{
            fail: "fail";
            info: "info";
            uncertain: "uncertain";
            warn: "warn";
        }>;
        claim: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                cast: "cast";
                event: "event";
                frame: "frame";
                mark: "mark";
            }>;
            id: z.ZodString;
            timestamp: z.ZodNumber;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        markId: z.ZodOptional<z.ZodString>;
        expectationId: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodString>;
        repairHint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    checks: z.ZodArray<z.ZodObject<{
        checkId: z.ZodString;
        kind: z.ZodEnum<{
            budget: "budget";
            literal: "literal";
            stall: "stall";
            ui: "ui";
            validator: "validator";
        }>;
        passed: z.ZodBoolean;
        score: z.ZodNumber;
        details: z.ZodString;
        expectationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    evidenceIndex: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            cast: "cast";
            event: "event";
            frame: "frame";
            mark: "mark";
        }>;
        id: z.ZodString;
        timestamp: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    firstDivergentMark: z.ZodOptional<z.ZodString>;
    hint: z.ZodObject<{
        owner: z.ZodOptional<z.ZodString>;
        hypothesis: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    acceptance: z.ZodObject<{
        resolve: z.ZodArray<z.ZodString>;
        noNewFindingsAtOrAbove: z.ZodLiteral<"warn">;
        checksMustPass: z.ZodLiteral<true>;
        maxDurationMs: z.ZodNumber;
    }, z.core.$strip>;
    doNotEdit: z.ZodArray<z.ZodString>;
    riskTier: z.ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
    }>;
}, z.core.$strip>;
export type RepairTask = z.infer<typeof RepairTaskSchema>;
export declare const ManifestSchema: z.ZodObject<{
    runId: z.ZodString;
    program: z.ZodAny;
    gitSha: z.ZodString;
    seed: z.ZodString;
    lane: z.ZodEnum<{
        hermetic: "hermetic";
        live: "live";
    }>;
    marks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        t: z.ZodNumber;
        castT: z.ZodOptional<z.ZodNumber>;
        videoT: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    artifactHashes: z.ZodRecord<z.ZodString, z.ZodString>;
    eventDigest: z.ZodString;
    fromSeq: z.ZodNumber;
    toSeq: z.ZodNumber;
}, z.core.$strip>;
export type Manifest = z.infer<typeof ManifestSchema>;
export declare const MarkSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    t: z.ZodNumber;
    castT: z.ZodOptional<z.ZodNumber>;
    videoT: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type Mark = z.infer<typeof MarkSchema>;
export declare function createFindingSignature(kind: FindingKind, expectationId?: string, markId?: string): string;
export declare function createCheckId(kind: CheckKind, expectationId: string): string;
export declare function generateId(): string;
//# sourceMappingURL=schema.d.ts.map