/**
 * Proposal event schema generators for the genome.
 */

export function generateProposalEventSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Proposal events ---');
  lines.push('const EnvelopeSchema = z.object({');
  lines.push('  proposalId: nonEmpty(),');
  lines.push('  schemaVersion: positiveInt(),');
  lines.push('  baseRevision: nonNegativeInt(),');
  lines.push('  cyclesPerProposal: positiveInt(),');
  lines.push('  issuedAtCycle: nonNegativeInt(),');
  lines.push('  references: z.array(z.string()),');
  lines.push('});');
  lines.push('');

  lines.push('export const ContentProposalSchema = EnvelopeSchema.extend({');
  lines.push("  kind: z.literal('content'),");
  lines.push('  payload: z.object({');
  lines.push('    taskType: TaskTypeSchema,');
  lines.push('    term: nonEmpty(),');
  lines.push('    truth: TruthValueSchema.optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const RuleProposalSchema = EnvelopeSchema.extend({');
  lines.push("  kind: z.literal('rule'),");
  lines.push('  payload: z.object({');
  lines.push('    ruleId: nonEmpty(),');
  lines.push('    name: nonEmpty(),');
  lines.push('    pattern: RulePatternSchema,');
  lines.push("    truthFn: nonEmpty(),");
  lines.push('    priority: unitInterval(),');
  lines.push('    body: z.string().optional(),');
  lines.push('    symbolicFallback: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ProposalSchema = z.discriminatedUnion(\'kind\', [ContentProposalSchema, RuleProposalSchema]);');
  lines.push('export type ContentProposal = z.infer<typeof ContentProposalSchema>;');
  lines.push('export type RuleProposal = z.infer<typeof RuleProposalSchema>;');
  lines.push('export type Proposal = z.infer<typeof ProposalSchema>;');
  lines.push('');

  lines.push('export const ProposalRejectedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('proposal.rejected'),");
  lines.push('  engine: z.literal(PROPOSER_ORIGIN),');
  lines.push('  payload: z.object({');
  lines.push('    proposalId: z.string(),');
  lines.push('    kind: z.enum(PROPOSAL_KINDS),');
  lines.push('    reason: z.enum(PROPOSAL_REJECTIONS),');
  lines.push('    detail: z.string(),');
  lines.push('    observedRevision: nonNegativeInt(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ProposalAdmittedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('proposal.admitted'),");
  lines.push('  engine: z.literal(PROPOSER_ORIGIN),');
  lines.push('  payload: z.object({');
  lines.push('    proposalId: z.string(),');
  lines.push('    kind: z.enum(PROPOSAL_KINDS),');
  lines.push('    schemaVersion: positiveInt(),');
  lines.push('    baseRevision: nonNegativeInt(),');
  lines.push('    resultingRevision: positiveInt(),');
  lines.push('    declaration: RuleDeclarationSchema.optional(),');
  lines.push('    producer: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  return lines;
}