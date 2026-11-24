/**
 * Rule table schema generators for the genome.
 */

export function generateRuleSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Rule table ---');
  lines.push('export const RuleProvenanceSchema = z.discriminatedUnion(\'kind\', [');
  lines.push("  z.object({ kind: z.literal('builtin') }),");
  lines.push('  z.object({');
  lines.push('    kind: z.literal(\'proposal\'),');
  lines.push('    proposalId: nonEmpty(),');
  lines.push('    producer: nonEmpty().optional(),');
  lines.push('  }),');
  lines.push("  z.object({ kind: z.literal('import'), source: nonEmpty() }),");
  lines.push(']);');
  lines.push('export type RuleProvenance = z.infer<typeof RuleProvenanceSchema>;');
  lines.push('');

  lines.push('export const RuleDeclarationSchema = z.object({');
  lines.push('  ruleId: nonEmpty(),');
  lines.push('  description: z.string(),');
  lines.push('  ...RulePatternSchema.shape,');
  lines.push("  truthFn: nonEmpty(),");
  lines.push("  body: nonEmpty(),");
  lines.push('  priority: z.number(),');
  lines.push('  taskType: z.enum(TASK_TYPES).optional(),');
  lines.push('});');
  lines.push('export type RuleDeclaration = z.infer<typeof RuleDeclarationSchema>;');
  lines.push('');

  lines.push('export const RuleArtifactEntrySchema = RuleDeclarationSchema.extend({');
  lines.push('  artifactVersion: nonEmpty(),');
  lines.push('  ruleSetRevision: nonNegativeInt(),');
  lines.push('  parentRevision: nonNegativeInt().nullable(),');
  lines.push('  ruleSchemaVersion: positiveInt(),');
  lines.push('  provenance: RuleProvenanceSchema,');
  lines.push('  eventId: z.string().optional(),');
  lines.push('});');
  lines.push('export type RuleArtifactEntry = z.infer<typeof RuleArtifactEntrySchema>;');
  lines.push('');

  lines.push('export const RuleTableSchema = z.object({');
  lines.push('  schemaVersion: positiveInt(),');
  lines.push('  artifactVersion: nonEmpty(),');
  lines.push('  revision: nonNegativeInt(),');
  lines.push('  entries: z.array(RuleArtifactEntrySchema),');
  lines.push('});');
  lines.push('export type RuleTable = z.infer<typeof RuleTableSchema>;');
  lines.push('');

  lines.push('export interface RuleTableDiff {');
  lines.push('  readonly from: number;');
  lines.push('  readonly to: number;');
  lines.push('  readonly added: readonly string[];');
  lines.push('  readonly removed: readonly string[];');
  lines.push('  readonly superseded: readonly string[];');
  lines.push('  readonly unchanged: number;');
  lines.push('}');
  lines.push('');

  lines.push("export const RULE_TABLE_REJECTIONS = ['schema-version', 'artifact-version', 'duplicate-rule-id', 'unresolved-body', 'empty-id'] as const;");
  lines.push('export type RuleTableRejection = (typeof RULE_TABLE_REJECTIONS)[number];');
  lines.push('');

  lines.push('export interface RuleTableFault {');
  lines.push('  readonly ruleId: string;');
  lines.push('  readonly reason: RuleTableRejection;');
  lines.push('  readonly detail: string;');
  lines.push('}');
  lines.push('');

  return lines;
}