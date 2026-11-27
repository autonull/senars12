/**
 * Graph node data (UI flat view) + lens
 */
import { z } from 'zod';
export declare const GraphNodeDataView: z.ZodObject<{
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
    truth: any;
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
export type GraphNodeDataView = z.infer<typeof GraphNodeDataView>;
export declare const GraphNodeData: z.ZodObject<{
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
    truth: any;
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
export type GraphNodeData = z.infer<typeof GraphNodeDataView>;
export declare const Lens: z.ZodString;
export type Lens = z.infer<typeof Lens>;
//# sourceMappingURL=graph-view.d.ts.map