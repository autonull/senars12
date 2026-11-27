/**
 * Log Events — canonical event types for the append-only log.
 *
 * Every state mutation in the system is an event. Events are immutable,
 * totally ordered by stamp, and form the single source of truth for
 * replay, snapshot, and verification.
 */
import type { UUID, TimestampMs } from '../generated/schemas';
import { z } from 'zod';
import { TaskTypeSchema, type TaskType, TaskBagKindSchema, type TaskBagKind } from '../schemas/task';
import { CognitiveEventSchema, type CognitiveEvent, TruthValueSchema, type TruthValue, TermSchema, type Term, StampSchema, type Stamp, SourceQualitySchema, type SourceQuality, BudgetScopeIdSchema, type BudgetScopeId, TerminationReasonSchema, type TerminationReason, type DerivationStep, type DerivationRecord } from '../generated/schemas';
export type { UUID, TimestampMs, CognitiveEvent, TruthValue, Term, Stamp, TaskType, TaskBagKind, SourceQuality, BudgetScopeId, TerminationReason, DerivationStep, DerivationRecord, };
export { CognitiveEventSchema, TruthValueSchema, TermSchema, StampSchema, TaskTypeSchema, TaskBagKindSchema, SourceQualitySchema, BudgetScopeIdSchema, TerminationReasonSchema, };
/** Envelope for a log entry: event + metadata. */
export declare const LogEntrySchema: z.ZodObject<{
    id: any;
    seq: any;
    ts: any;
    event: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    parents: z.ZodDefault<z.ZodArray<any>>;
    hash: any;
}, z.core.$strip>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
/** Compute the content hash of a log entry (excluding id, seq, hash). */
export declare const hashEntry: (entry: Omit<LogEntry, 'id' | 'seq' | 'hash'>) => string;
/** Create a log entry from an event. */
export declare const createLogEntry: (event: CognitiveEvent, options?: {
    parents?: UUID[];
    ts?: TimestampMs;
}) => Omit<LogEntry, 'id' | 'seq' | 'hash'>;
/** Event type guards for pattern matching. */
export declare const isTaskAdmittedEvent: (e: CognitiveEvent) => e is CognitiveEvent & {
    type: 'task.admitted';
};
export declare const isDerivationAcceptedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'derivation.accepted';
}>;
export declare const isGatePassedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'gate.passed';
}>;
export declare const isGateFailedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'gate.failed';
}>;
export declare const isGateEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'gate.passed' | 'gate.failed';
}>;
export declare const isBudgetConsumedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'budget.consumed';
}>;
export declare const isBudgetExhaustedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'budget.exhausted';
}>;
export declare const isBudgetEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'budget.consumed' | 'budget.exhausted';
}>;
export declare const isProposalSubmittedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'proposal.submitted';
}>;
export declare const isProposalAdmittedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'proposal.admitted';
}>;
export declare const isProposalRejectedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'proposal.rejected';
}>;
export declare const isProposalEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'proposal.submitted' | 'proposal.admitted' | 'proposal.rejected';
}>;
export declare const isSnapshotCreatedEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'snapshot.created';
}>;
export declare const isSnapshotRestoredEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'snapshot.restored';
}>;
export declare const isSnapshotEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'snapshot.created' | 'snapshot.restored';
}>;
export declare const isDerivationMadeEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'derivation.made';
}>;
export declare const isDerivationRecordEvent: (e: CognitiveEvent) => e is Extract<CognitiveEvent, {
    type: 'derivation.record';
}>;
/**
 * EventLog interface for the unified log store.
 */
export interface EventLog {
    append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;
    subscribe(options?: {
        filter?: (event: CognitiveEvent) => boolean;
        fromId?: string;
        types?: string[];
    }): AsyncIterable<CognitiveEvent>;
    query(query: EventLogQuery): Promise<CognitiveEvent[]>;
    getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
    close(): Promise<void>;
    getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;
    saveSnapshot<T>(projectionName: string, version: number, data: T): Promise<void>;
}
/**
 * Configuration for EventLog.
 */
export interface EventLogConfig {
    maxEvents?: number;
    maxEventSize?: number;
}
/**
 * Filtered read of the log. All fields optional, and the *unfiltered* read is
 * `getRange('', '')` — this exists so a caller that bounds its read can say so,
 * and so an implementation with an index can filter and limit in the store
 * rather than materializing the log and discarding most of it.
 */
export interface EventLogQuery {
    correlationId?: string;
    /** Type allowlist. Empty or absent means *every* type, so `[]` is not "nothing". */
    types?: string[];
    /** Inclusive `[from, to]` on `timestamp`; absent means unbounded. */
    timeRange?: [number, number];
    /** Keep the most recent `limit` matching events, still returned in id order. */
    limit?: number;
}
/**
 * A type allowlist as a membership test, or `undefined` for *every* type. The two
 * implementations and the subscription replay each built their own `Set`, and the
 * subscription's `types: []` matched nothing while a query's `types: []` matched
 * everything — the same argument, two answers, from one contract that documents
 * "empty or absent means every type".
 */
export declare const typeSetOf: (types?: readonly string[]) => ReadonlySet<string> | undefined;
/** What a subscription filters on — the allowlist and the caller's own predicate. */
export interface SubscriptionFilter {
    types?: ReadonlySet<string>;
    filter?: (event: CognitiveEvent) => boolean;
}
/**
 * Whether a subscription admits an event: the allowlist first, then the caller's
 * own predicate. Written once because the replay path and the live-notify path
 * were two copies that had already drifted — replay ignored `fromId`.
 */
export declare const subscriptionAdmits: ({ types, filter }: SubscriptionFilter, event: CognitiveEvent) => boolean;
//# sourceMappingURL=events.d.ts.map