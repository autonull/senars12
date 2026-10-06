/**
 * Lens registry message schemas
 */
import { unique } from '@senars/util';
import { z } from 'zod';
import { LENS_FIELDS, type LensFieldDescriptor } from '../constants.js';
import { LensSpecSchema } from '../lens-schema.js';
import { msg } from './envelope.js';

type LensFieldType = LensFieldDescriptor['type'];

/** The wire lens is the lens: one declaration, guards and modulation check included. */
const LensDef = LensSpecSchema;

export const LensListMsg = msg('lens.list', { lenses: z.array(LensDef) });

export const LensDefineMsg = msg('lens.define', { lens: LensDef });

export const LensDefinedMsg = msg('lens.defined', { lens: LensDef });

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

export const LensFieldsMsg = msg('lens.fields', { fields: z.array(LensFieldSchema) });
