/**
 * Lens registry message schemas
 */
import { unique } from '@senars/util';
import { z } from 'zod';
import { LENS_FIELDS, type LensFieldDescriptor } from '../constants.js';
import { LensSpecSchema } from '../lens-schema.js';

type LensFieldType = LensFieldDescriptor['type'];

/** The wire lens is the lens: one declaration, guards and modulation check included. */
const LensDef = LensSpecSchema;

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

/**
 * The wire field shape, with its type vocabulary read off the descriptor table
 * rather than restated: the schema used to spell `['number','boolean',...]` as a
 * literal, so a field type the descriptors declared and the wire schema did not
 * was rejected at the boundary.
 */
const LENS_FIELD_TYPES = unique(LENS_FIELDS.map((field) => field.type));

const LensFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(LENS_FIELD_TYPES as [LensFieldType, ...LensFieldType[]]),
});

export const LensFieldsMsg = z.object({
  type: z.literal('lens.fields'),
  fields: z.array(LensFieldSchema),
});
