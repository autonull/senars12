import { z } from 'zod';

/** JSON-serializable form of a Modulation AST node. Defined manually to avoid circular type inference. */
export type ModulationSpec =
  | { op: 'const'; value: string | number | boolean }
  | { op: 'field'; field: string; map?: string }
  | { op: 'channel'; channel: string; child: ModulationSpec }
  | { op: 'when'; predicate: string; child: ModulationSpec }
  | { op: 'union'; children: ModulationSpec[] };

/** Recursive Zod schema for ModulationSpec. */
export const ModulationSchema: z.ZodType<ModulationSpec> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('const'), value: z.union([z.string(), z.number(), z.boolean()]) }),
    z.object({ op: z.literal('field'), field: z.string(), map: z.string().optional() }),
    z.object({
      op: z.literal('channel'),
      channel: z.string(),
      child: z.lazy(() => ModulationSchema),
    }),
    z.object({
      op: z.literal('when'),
      predicate: z.string(),
      child: z.lazy(() => ModulationSchema),
    }),
    z.object({ op: z.literal('union'), children: z.array(z.lazy(() => ModulationSchema)) }),
  ])
);

/** Zod schema for a full Lens definition. */
export const LensSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  modulation: ModulationSchema,
  requires: z.array(z.string()).optional(),
});

export type LensSpec = z.infer<typeof LensSpecSchema>;

/** Built-in lens IDs shipped with the system. */
export const BUILTIN_LENS_IDS = ['belief', 'goal', 'contradiction'] as const;
export type BuiltinLens = (typeof BUILTIN_LENS_IDS)[number];

/** Returns true if a lens ID is a built-in. */
export function isBuiltinLens(id: string): id is BuiltinLens {
  return BUILTIN_LENS_IDS.includes(id as BuiltinLens);
}

/** Build the built-in lens specs with capability requirements. */
export function builtinLensSpecs(): LensSpec[] {
  return [
    {
      id: 'belief',
      label: 'Beliefs',
      description: 'What the system knows — color by truth frequency, opacity by confidence',
      requires: ['truth-revision'],
      modulation: {
        op: 'union',
        children: [
          {
            op: 'channel',
            channel: 'opacity',
            child: { op: 'field', field: 'confidence', map: 'confidence-to-opacity' },
          },
          {
            op: 'channel',
            channel: 'color',
            child: { op: 'field', field: 'truth', map: 'truth-to-color' },
          },
          { op: 'channel', channel: 'size', child: { op: 'const', value: 30 } },
        ],
      },
    },
    {
      id: 'goal',
      label: 'Goals',
      description: 'What the system wants — size by priority',
      requires: ['goal-management'],
      modulation: {
        op: 'union',
        children: [
          {
            op: 'channel',
            channel: 'size',
            child: { op: 'field', field: 'priority', map: 'priority-to-size' },
          },
          { op: 'channel', channel: 'color', child: { op: 'const', value: '#00f3ff' } },
          { op: 'channel', channel: 'opacity', child: { op: 'const', value: 0.85 } },
        ],
      },
    },
    {
      id: 'contradiction',
      label: 'Conflicts',
      description: 'Where beliefs conflict — highlight with orange and dashed stroke',
      requires: ['truth-revision'],
      modulation: {
        op: 'union',
        children: [
          {
            op: 'when',
            predicate: 'isContradiction',
            child: { op: 'channel', channel: 'color', child: { op: 'const', value: '#ffaa00' } },
          },
          {
            op: 'when',
            predicate: 'isContradiction',
            child: { op: 'channel', channel: 'stroke.dash', child: { op: 'const', value: '4 2' } },
          },
        ],
      },
    },
  ];
}

/** Generate a simple JSON Schema representation from LensSpecSchema (for editor validation). */
export function lensSpecToJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['id', 'label', 'modulation'],
    properties: {
      id: { type: 'string', minLength: 1, description: 'Unique lens identifier' },
      label: { type: 'string', minLength: 1, description: 'Human-readable lens name' },
      description: { type: 'string', description: 'Short description of what the lens does' },
      modulation: {
        type: 'object',
        description: 'Modulation AST defining the visual mapping',
        discriminator: { propertyName: 'op' },
        oneOf: [
          {
            properties: {
              op: { type: 'string', enum: ['const'] },
              value: { type: ['string', 'number', 'boolean'] },
            },
            required: ['op', 'value'],
          },
          {
            properties: {
              op: { type: 'string', enum: ['field'] },
              field: { type: 'string' },
              map: { type: 'string' },
            },
            required: ['op', 'field'],
          },
          {
            properties: {
              op: { type: 'string', enum: ['channel'] },
              channel: { type: 'string' },
              child: { $ref: '#/properties/modulation' },
            },
            required: ['op', 'channel', 'child'],
          },
          {
            properties: {
              op: { type: 'string', enum: ['when'] },
              predicate: { type: 'string' },
              child: { $ref: '#/properties/modulation' },
            },
            required: ['op', 'predicate', 'child'],
          },
          {
            properties: {
              op: { type: 'string', enum: ['union'] },
              children: { type: 'array', items: { $ref: '#/properties/modulation' } },
            },
            required: ['op', 'children'],
          },
        ],
      },
    },
  };
}
