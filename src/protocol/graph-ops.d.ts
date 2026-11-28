/**
 * Graph operations (delta) + cognitive delta
 */
import { z } from 'zod';
export declare const GraphOp: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strip>], "action">;
export type GraphOp = z.infer<typeof GraphOp>;
export type GraphOpType = z.infer<typeof GraphOp>;
export declare const CognitiveDelta: z.ZodObject<{
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
}, z.core.$strip>;
//# sourceMappingURL=graph-ops.d.ts.map