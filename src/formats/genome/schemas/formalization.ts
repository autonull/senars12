/**
 * Formalization schema generators for the genome.
 */

export function generateFormalizationSchemas(): string[] {
  const lines: string[] = [];
  
  // --- Formalization ---
  lines.push('export const ambiguitySeverityOf = (type: AMBIGUITY_TYPE): typeof AMBIGUITY_SEVERITIES[number] => AMBIGUITY_SEVERITY[type] as typeof AMBIGUITY_SEVERITIES[number];');
  lines.push('');
  
  lines.push('export type AmbiguityType = AMBIGUITY_TYPE;');
  lines.push('');
  
  lines.push('export const AmbiguityReportSchema = z.object({');
  lines.push('  type: z.enum(AMBIGUITY_TYPES),');
  lines.push('  description: z.string(),');
  lines.push('  options: z.array(z.string()),');
  lines.push('  confidence: unitInterval(),');
  lines.push('});');
  lines.push('export type AmbiguityReport = z.infer<typeof AmbiguityReportSchema>;');
  lines.push('');
  
  lines.push('export const AmbiguityFlagSchema = AmbiguityReportSchema.extend({');
  lines.push('  severity: z.enum(AMBIGUITY_SEVERITIES),');
  lines.push('});');
  lines.push('export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;');
  lines.push('');
  
  lines.push('export const SourceSpanSchema = z.object({');
  lines.push('  start: nonNegativeInt(),');
  lines.push('  end: nonNegativeInt(),');
  lines.push('  text: z.string(),');
  lines.push('});');
  lines.push('export type SourceSpan = z.infer<typeof SourceSpanSchema>;');
  lines.push('');
  
  lines.push('export const FormalizationCandidateSchema = z.object({');
  lines.push('  candidateId: uuid(),');
  lines.push('  narsese: z.string(),');
  lines.push('  taskType: z.enum(TASK_TYPES),');
  lines.push('  truth: TruthValueSchema.optional(),');
  lines.push('  confidence: unitInterval(),');
  lines.push('  sourceSpans: z.array(SourceSpanSchema),');
  lines.push('  ambiguityFlags: z.array(AmbiguityFlagSchema),');
  lines.push('  metadata: z.object({');
  lines.push('    model: z.string().optional(),');
  lines.push('    promptTokens: nonNegativeInt().optional(),');
  lines.push('    completionTokens: nonNegativeInt().optional(),');
  lines.push('    latencyMs: nonNegativeInt().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type FormalizationCandidate = z.infer<typeof FormalizationCandidateSchema>;');
  lines.push('');
  
  lines.push('export const FormalizationBatchSchema = z.object({');
  lines.push('  batchId: uuid(),');
  lines.push('  sourceText: z.string(),');
  lines.push('  candidates: z.array(FormalizationCandidateSchema),');
  lines.push('  detectedIntent: z.enum(DETECTED_INTENTS).optional(),');
  lines.push('  globalAmbiguities: z.array(AmbiguityFlagSchema).optional(),');
  lines.push('});');
  lines.push('export type FormalizationBatch = z.infer<typeof FormalizationBatchSchema>;');
  lines.push('');
  
  lines.push('export const DetectedIntentSchema = z.enum(DETECTED_INTENTS);');
  lines.push('export type DetectedIntent = z.infer<typeof DetectedIntentSchema>;');
  lines.push('');

  return lines;
}