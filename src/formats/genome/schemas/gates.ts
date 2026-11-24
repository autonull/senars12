/**
 * Gate I/O schema generators for the genome.
 */

export function generateGateSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Gate I/O ---');
  lines.push('export const PerceptionGateInputSchema = z.object({');
  lines.push('  sourceId: z.string(),');
  lines.push('  source: z.enum(STIMULUS_SOURCES).optional(),');
  lines.push('  rawObservation: z.unknown(),');
  lines.push('  sensorConfidence: unitInterval(),');
  lines.push('  sourceQuality: SourceQualitySchema,');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type PerceptionGateInput = z.infer<typeof PerceptionGateInputSchema>;');
  lines.push('');

  lines.push('export const ActionGateInputSchema = z.object({');
  lines.push('  proposalId: uuid(),');
  lines.push('  operation: z.string(),');
  lines.push('  args: z.record(z.string(), z.unknown()),');
  lines.push('  proposerReflexId: z.string().optional(),');
  lines.push('  nalDerivationId: uuid().optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type ActionGateInput = z.infer<typeof ActionGateInputSchema>;');
  lines.push('');

  lines.push('export const ActionGateOutputSchema = z.object({');
  lines.push('  authorized: z.boolean(),');
  lines.push('  toolCallId: uuid().optional(),');
  lines.push('  vetoReason: z.string().optional(),');
  lines.push('  requiredApprovals: z.array(z.string()).optional(),');
  lines.push('});');
  lines.push('export type ActionGateOutput = z.infer<typeof ActionGateOutputSchema>;');
  lines.push('');

  lines.push('export const RewardGateInputSchema = z.object({');
  lines.push('  eventId: uuid(),');
  lines.push('  rewardSignal: signedUnitInterval(),');
  lines.push("  rewardType: z.enum(['extrinsic', 'intrinsic', 'derivation-depth-reduction', 'self-model-accuracy', 'contradiction-reduction']),");
  lines.push("  targetType: z.enum(['attention-priority', 'policy-weights', 'truth-frequency', 'truth-confidence']),");
  lines.push('  targetId: z.string(),');
  lines.push('  domain: z.enum(REWARD_DOMAINS).optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type RewardGateInput = z.infer<typeof RewardGateInputSchema>;');
  lines.push('');

  lines.push('export const RewardGateOutputSchema = z.object({');
  lines.push('  accepted: z.boolean(),');
  lines.push('  mutationApplied: z.boolean().optional(),');
  lines.push('  epistemicFirewallViolation: z.boolean().optional(),');
  lines.push('  rejectionReason: z.string().optional(),');
  lines.push('  requiresProposal: z.boolean().optional(),');
  lines.push('});');
  lines.push('export type RewardGateOutput = z.infer<typeof RewardGateOutputSchema>;');
  lines.push('');

  lines.push('export const BudgetOperationSchema = z.enum(BUDGET_OPERATIONS);');
  lines.push('export type BudgetOperation = z.infer<typeof BudgetOperationSchema>;');
  lines.push('');

  return lines;
}