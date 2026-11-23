/** @public The vocabularies a cognitive event carries, so the zod boundary in `core`
 *  cannot admit an origin, a band, an axis or a query shape the types do not carry. */
export {
  BANDS,
  BandDecisionSchema,
  bandOrdinal,
  COGNITIVE_AXES,
  CognitiveAxisSchema,
  egressVerdict,
  JUDGMENT_SHAPES,
  JudgmentShapeSchema,
} from '../cognitive-schemas';