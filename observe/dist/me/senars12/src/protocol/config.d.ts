/**
 * Configuration message schemas
 */
import { z } from 'zod';
export declare const ConfigField: z.ZodObject<{
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
}, z.core.$strip>;
export declare const ConfigSchemaMsg: z.ZodObject<{
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
}, z.core.$strip>;
export declare const ConfigSetMsg: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodAny;
    type: z.ZodLiteral<"config.set">;
}, z.core.$strip>;
//# sourceMappingURL=config.d.ts.map