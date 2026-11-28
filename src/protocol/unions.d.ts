/**
 * Incoming message discriminated unions + aggregate type re-exports
 */
import { z } from 'zod';
import { type ConfigField } from './config';
export declare const IncomingFromClient: z.ZodDiscriminatedUnion<[z.ZodObject<{
    content: z.ZodString;
    mode: z.ZodOptional<z.ZodString>;
    contexts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    type: z.ZodLiteral<"chat.user">;
}, z.core.$strip>, z.ZodObject<{
    key: z.ZodString;
    value: z.ZodAny;
    type: z.ZodLiteral<"config.set">;
}, z.core.$strip>, z.ZodObject<{
    lastSeqId: z.ZodNullable<z.ZodNumber>;
    type: z.ZodLiteral<"sync.request">;
}, z.core.$strip>, z.ZodObject<{
    lens: z.ZodString;
    type: z.ZodLiteral<"lens.set">;
}, z.core.$strip>, z.ZodObject<{
    term: z.ZodString;
    type: z.ZodLiteral<"focus.set">;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodEnum<{
        edge: "edge";
        node: "node";
    }>;
    id: z.ZodString;
    patch: z.ZodObject<{
        truth: z.ZodOptional<z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>>;
        type: z.ZodOptional<z.ZodString>;
        priority: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"object.set">;
}, z.core.$strip>, z.ZodObject<{
    lens: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"lens.define">;
}, z.core.$strip>, z.ZodObject<{
    term: z.ZodString;
    type: z.ZodLiteral<"node.history.request">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"lm.status.request">;
}, z.core.$strip>, z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"lm.switch">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        belief: "belief";
        goal: "goal";
        question: "question";
    }>>;
    type: z.ZodLiteral<"reasoning.submit">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    runs: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.ask">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.step">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.run">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"reasoning.abort">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    nodeId: z.ZodString;
    type: z.ZodLiteral<"reasoning.retract">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    nodeId: z.ZodString;
    frequency: z.ZodNumber;
    confidence: z.ZodNumber;
    type: z.ZodLiteral<"reasoning.revise">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    term: z.ZodString;
    type: z.ZodLiteral<"reasoning.add-goal">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    budget: z.ZodNumber;
    type: z.ZodLiteral<"reasoning.adjust-budget">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    provider: z.ZodString;
    type: z.ZodLiteral<"reasoning.adjust-provider">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.step">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.pause">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.resume">;
}, z.core.$strip>, z.ZodObject<{
    cycles: z.ZodOptional<z.ZodNumber>;
    seqId: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"cycle.rewind">;
}, z.core.$strip>], "type">;
export declare const IncomingFromServer: z.ZodDiscriminatedUnion<[z.ZodObject<{
    delta: z.ZodString;
    type: z.ZodLiteral<"chat.agent.stream">;
}, z.core.$strip>, z.ZodObject<{
    content: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    type: z.ZodLiteral<"chat.agent.complete">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodNumber;
    lens: z.ZodString;
    ops: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        data: z.ZodObject<{
            lensData: z.ZodOptional<z.ZodObject<{
                score: z.ZodNumber;
                color: z.ZodString;
                size: z.ZodNumber;
            }, z.core.$strip>>;
            layout: z.ZodOptional<z.ZodObject<{
                x: z.ZodOptional<z.ZodNumber>;
                y: z.ZodOptional<z.ZodNumber>;
                threadIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            truth: z.ZodOptional<z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>>;
            isContradiction: z.ZodOptional<z.ZodBoolean>;
            occurrenceTime: z.ZodOptional<z.ZodNumber>;
            goalRelevance: z.ZodOptional<z.ZodNumber>;
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
            term: z.ZodOptional<z.ZodString>;
            atom: z.ZodOptional<z.ZodString>;
            skill: z.ZodOptional<z.ZodString>;
            priority: z.ZodOptional<z.ZodNumber>;
            confidence: z.ZodOptional<z.ZodNumber>;
            nodeType: z.ZodEnum<{
                "metta:atom": "metta:atom";
                "metta:skill": "metta:skill";
                "nar:concept": "nar:concept";
            }>;
            capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            html: z.ZodOptional<z.ZodString>;
            punctuation: z.ZodOptional<z.ZodEnum<{
                "!": "!";
                ".": ".";
                ";": ";";
                "?": "?";
            }>>;
            space: z.ZodOptional<z.ZodString>;
            durationMs: z.ZodOptional<z.ZodNumber>;
            args: z.ZodOptional<z.ZodArray<z.ZodString>>;
            type: z.ZodOptional<z.ZodString>;
            result: z.ZodOptional<z.ZodString>;
            rule: z.ZodOptional<z.ZodString>;
            cpuMs: z.ZodOptional<z.ZodNumber>;
            lmCalls: z.ZodOptional<z.ZodNumber>;
            lmTokens: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        action: z.ZodLiteral<"add_node">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        data: z.ZodObject<{
            lensData: z.ZodOptional<z.ZodObject<{
                score: z.ZodNumber;
                color: z.ZodString;
                size: z.ZodNumber;
            }, z.core.$strip>>;
            layout: z.ZodOptional<z.ZodObject<{
                x: z.ZodOptional<z.ZodNumber>;
                y: z.ZodOptional<z.ZodNumber>;
                threadIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            truth: z.ZodOptional<z.ZodObject<{
                frequency: z.ZodNumber;
                confidence: z.ZodNumber;
            }, z.core.$strip>>;
            isContradiction: z.ZodOptional<z.ZodBoolean>;
            occurrenceTime: z.ZodOptional<z.ZodNumber>;
            goalRelevance: z.ZodOptional<z.ZodNumber>;
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
            term: z.ZodOptional<z.ZodString>;
            atom: z.ZodOptional<z.ZodString>;
            skill: z.ZodOptional<z.ZodString>;
            priority: z.ZodOptional<z.ZodNumber>;
            confidence: z.ZodOptional<z.ZodNumber>;
            nodeType: z.ZodEnum<{
                "metta:atom": "metta:atom";
                "metta:skill": "metta:skill";
                "nar:concept": "nar:concept";
            }>;
            capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            html: z.ZodOptional<z.ZodString>;
            punctuation: z.ZodOptional<z.ZodEnum<{
                "!": "!";
                ".": ".";
                ";": ";";
                "?": "?";
            }>>;
            space: z.ZodOptional<z.ZodString>;
            durationMs: z.ZodOptional<z.ZodNumber>;
            args: z.ZodOptional<z.ZodArray<z.ZodString>>;
            type: z.ZodOptional<z.ZodString>;
            result: z.ZodOptional<z.ZodString>;
            rule: z.ZodOptional<z.ZodString>;
            cpuMs: z.ZodOptional<z.ZodNumber>;
            lmCalls: z.ZodOptional<z.ZodNumber>;
            lmTokens: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        action: z.ZodLiteral<"update_node">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        action: z.ZodLiteral<"remove_node">;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        data: z.ZodOptional<z.ZodObject<{
            weight: z.ZodNumber;
            type: z.ZodString;
            directed: z.ZodBoolean;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"add_edge">;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        action: z.ZodLiteral<"remove_edge">;
    }, z.core.$strip>], "action">>;
    meta: z.ZodOptional<z.ZodObject<{
        truncated: z.ZodOptional<z.ZodBoolean>;
        totalHidden: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"cognitive.delta">;
}, z.core.$strip>, z.ZodObject<{
    events: z.ZodArray<z.ZodAny>;
    type: z.ZodLiteral<"cognitive.events">;
}, z.core.$strip>, z.ZodObject<{
    data: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            dropdown: "dropdown";
            slider: "slider";
            text: "text";
            toggle: "toggle";
        }>;
        label: z.ZodString;
        value: z.ZodAny;
        options: z.ZodOptional<z.ZodArray<z.ZodString>>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        step: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<{
            advanced: "advanced";
            llm: "llm";
            nars: "nars";
            system: "system";
        }>>;
        validation: z.ZodOptional<z.ZodObject<{
            pattern: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"config.schema">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodNumber;
    data: z.ZodObject<{
        graph: z.ZodObject<{
            nodes: z.ZodArray<z.ZodAny>;
            edges: z.ZodArray<z.ZodAny>;
        }, z.core.$strip>;
        workingMemory: z.ZodArray<z.ZodAny>;
        config: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<{
                dropdown: "dropdown";
                slider: "slider";
                text: "text";
                toggle: "toggle";
            }>;
            label: z.ZodString;
            value: z.ZodAny;
            options: z.ZodOptional<z.ZodArray<z.ZodString>>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            description: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodEnum<{
                advanced: "advanced";
                llm: "llm";
                nars: "nars";
                system: "system";
            }>>;
            validation: z.ZodOptional<z.ZodObject<{
                pattern: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"state.snapshot">;
}, z.core.$strip>, z.ZodObject<{
    metrics: z.ZodObject<{
        reasoning_hz: z.ZodNumber;
        tokens_per_sec: z.ZodNumber;
        memory_mb: z.ZodNumber;
        ws_latency_ms: z.ZodNumber;
    }, z.core.$strip>;
    cognitive: z.ZodOptional<z.ZodObject<{
        activeConcepts: z.ZodNumber;
        totalConcepts: z.ZodNumber;
        derivationsPerSec: z.ZodNumber;
        contradictionCount: z.ZodNumber;
        workingMemorySize: z.ZodNumber;
        goalUrgencyDistribution: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"telemetry">;
}, z.core.$strip>, z.ZodObject<{
    lenses: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"lens.list">;
}, z.core.$strip>, z.ZodObject<{
    lens: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"lens.defined">;
}, z.core.$strip>, z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        type: z.ZodEnum<{
            boolean: "boolean";
            number: "number";
            object: "object";
            string: "string";
        }>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"lens.fields">;
}, z.core.$strip>, z.ZodObject<{
    term: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        truth: z.ZodObject<{
            frequency: z.ZodNumber;
            confidence: z.ZodNumber;
        }, z.core.$strip>;
        stampId: z.ZodString;
        timestamp: z.ZodNumber;
        source: z.ZodEnum<{
            derivation: "derivation";
            inference: "inference";
            input: "input";
            revision: "revision";
        }>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"node.history">;
}, z.core.$strip>, z.ZodObject<{
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    type: z.ZodLiteral<"lm.status">;
}, z.core.$strip>, z.ZodObject<{
    code: z.ZodEnum<{
        internal: "internal";
        invalid_message: "invalid_message";
        not_available: "not_available";
        unsupported: "unsupported";
    }>;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"server.error">;
}, z.core.$strip>, z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"ui.command">;
}, z.core.$strip>, z.ZodObject<{
    seqId: z.ZodOptional<z.ZodNumber>;
    ok: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
    answer: z.ZodOptional<z.ZodObject<{
        answer: z.ZodOptional<z.ZodString>;
        frequency: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
        hasDerivation: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    termination: z.ZodOptional<z.ZodArray<z.ZodObject<{
        scope: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>>>;
    type: z.ZodLiteral<"reasoning.control.response">;
}, z.core.$strip>, z.ZodObject<{
    state: z.ZodEnum<{
        paused: "paused";
        running: "running";
        stepping: "stepping";
    }>;
    cycleCount: z.ZodOptional<z.ZodNumber>;
    phase: z.ZodOptional<z.ZodString>;
    activeTasks: z.ZodOptional<z.ZodNumber>;
    budget: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    type: z.ZodLiteral<"cycle.state">;
}, z.core.$strip>], "type">;
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
//# sourceMappingURL=unions.d.ts.map