import { z } from 'zod';
export declare const LensListMsg: z.ZodObject<{
    lenses: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    type: z.ZodLiteral<"lens.list">;
}, z.core.$strip>;
export declare const LensDefineMsg: z.ZodObject<{
    lens: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"lens.define">;
}, z.core.$strip>;
export declare const LensDefinedMsg: z.ZodObject<{
    lens: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodString;
        modulation: z.ZodType<import("./lens-schema").ModulationSpec, unknown, z.core.$ZodTypeInternals<import("./lens-schema").ModulationSpec, unknown>>;
        requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    type: z.ZodLiteral<"lens.defined">;
}, z.core.$strip>;
export declare const LensFieldsMsg: z.ZodObject<{
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
}, z.core.$strip>;
//# sourceMappingURL=lens-msgs.d.ts.map