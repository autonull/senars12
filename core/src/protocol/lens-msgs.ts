/**
 * Lens registry message schemas
 */
import { z } from 'zod';

const LensDef = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  modulation: z.any(),
  requires: z.array(z.string()).optional(),
});

export const LensListMsg = z.object({
  type: z.literal('lens.list'),
  lenses: z.array(LensDef),
});

export const LensDefineMsg = z.object({
  type: z.literal('lens.define'),
  lens: LensDef,
});

export const LensDefinedMsg = z.object({
  type: z.literal('lens.defined'),
  lens: LensDef,
});

export const LensFieldsMsg = z.object({
  type: z.literal('lens.fields'),
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(['number', 'boolean', 'string', 'object']),
    })
  ),
});
