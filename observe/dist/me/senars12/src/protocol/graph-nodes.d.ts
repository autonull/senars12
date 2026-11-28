/**
 * Graph node schemas (engine-specific)
 */
import { z } from 'zod';
/** Optional UI lens attributes attached to any graph node. */
export declare const LensData: z.ZodObject<{
    score: z.ZodNumber;
    color: z.ZodString;
    size: z.ZodNumber;
}, z.core.$strip>;
export type LensData = z.infer<typeof LensData>;
/** Node position; `threadIndex` orders nodes inside a reasoning thread. */
export declare const NodeLayout: z.ZodObject<{
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    threadIndex: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type NodeLayout = z.infer<typeof NodeLayout>;
/** Optional UI lens attributes carried by every graph node. */
export declare const lensShape: {
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
};
/** Truth/attention annotations carried by every cognitively meaningful node. */
export declare const cognitionShape: {
    truth: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
    isContradiction: z.ZodOptional<z.ZodBoolean>;
    occurrenceTime: z.ZodOptional<z.ZodNumber>;
    goalRelevance: z.ZodOptional<z.ZodNumber>;
};
export declare const NarConceptNode: z.ZodObject<{
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
    term: z.ZodString;
    priority: z.ZodNumber;
    confidence: z.ZodNumber;
    html: z.ZodOptional<z.ZodString>;
    punctuation: z.ZodOptional<z.ZodEnum<{
        "!": "!";
        ".": ".";
        ";": ";";
        "?": "?";
    }>>;
    nodeType: z.ZodLiteral<"nar:concept">;
}, z.core.$strip>;
export declare const MettaAtomNode: z.ZodObject<{
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
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    atom: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    space: z.ZodString;
    nodeType: z.ZodLiteral<"metta:atom">;
}, z.core.$strip>;
export declare const MettaSkillNode: z.ZodObject<{
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
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    skill: z.ZodString;
    args: z.ZodArray<z.ZodString>;
    result: z.ZodString;
    durationMs: z.ZodNumber;
    nodeType: z.ZodLiteral<"metta:skill">;
}, z.core.$strip>;
export declare const GraphNodeDataStrict: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    term: z.ZodString;
    priority: z.ZodNumber;
    confidence: z.ZodNumber;
    html: z.ZodOptional<z.ZodString>;
    punctuation: z.ZodOptional<z.ZodEnum<{
        "!": "!";
        ".": ".";
        ";": ";";
        "?": "?";
    }>>;
    nodeType: z.ZodLiteral<"nar:concept">;
}, z.core.$strip>, z.ZodObject<{
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
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    atom: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    space: z.ZodString;
    nodeType: z.ZodLiteral<"metta:atom">;
}, z.core.$strip>, z.ZodObject<{
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
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    skill: z.ZodString;
    args: z.ZodArray<z.ZodString>;
    result: z.ZodString;
    durationMs: z.ZodNumber;
    nodeType: z.ZodLiteral<"metta:skill">;
}, z.core.$strip>], "nodeType">;
export type GraphNodeDataStrict = z.infer<typeof GraphNodeDataStrict>;
//# sourceMappingURL=graph-nodes.d.ts.map