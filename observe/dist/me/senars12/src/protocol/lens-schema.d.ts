import { z } from 'zod';
/** JSON-serializable form of a Modulation AST node. Defined manually to avoid circular type inference. */
export type ModulationSpec = {
    op: 'const';
    value: string | number | boolean;
} | {
    op: 'field';
    field: string;
    map?: string;
} | {
    op: 'channel';
    channel: string;
    child: ModulationSpec;
} | {
    op: 'when';
    predicate: string;
    child: ModulationSpec;
} | {
    op: 'union';
    children: ModulationSpec[];
};
/** Recursive Zod schema for ModulationSpec. */
export declare const ModulationSchema: z.ZodType<ModulationSpec>;
/** Zod schema for a full Lens definition. */
export declare const LensSpecSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    description: z.ZodString;
    modulation: z.ZodType<ModulationSpec, unknown, z.core.$ZodTypeInternals<ModulationSpec, unknown>>;
    requires: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type LensSpec = z.infer<typeof LensSpecSchema>;
/** Built-in lens IDs shipped with the system. */
export declare const BUILTIN_LENS_IDS: readonly ['belief', 'goal', 'contradiction', 'temporal'];
export type BuiltinLens = (typeof BUILTIN_LENS_IDS)[number];
/** Returns true if a lens ID is a built-in. */
export declare function isBuiltinLens(id: string): id is BuiltinLens;
/** Build the built-in lens specs with capability requirements. */
export declare function builtinLensSpecs(): LensSpec[];
/** Generate a simple JSON Schema representation from LensSpecSchema (for editor validation). */
export declare function lensSpecToJsonSchema(): Record<string, unknown>;
//# sourceMappingURL=lens-schema.d.ts.map