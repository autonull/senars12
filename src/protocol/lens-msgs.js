/**
 * Lens registry message schemas
 */
import { unique } from '@senars/util/collections';
import { z } from 'zod';
import { LENS_FIELDS } from '../agent/constants';
import { LensSpecSchema } from './lens-schema';
import { msg } from './envelope';
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
    type: z.enum(LENS_FIELD_TYPES),
});
export const LensFieldsMsg = msg('lens.fields', { fields: z.array(LensFieldSchema) });
