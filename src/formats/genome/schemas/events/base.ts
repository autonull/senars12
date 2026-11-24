/**
 * Event base schema generators for the genome.
 */

export function generateEventBaseSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Event base ---');
  lines.push('export const EngineOriginSchema = z.enum(ENGINE_ORIGINS);');
  lines.push('');

  lines.push('export const CognitiveEventBaseSchema = z.object({');
  lines.push('  engine: EngineOriginSchema,');
  lines.push('  timestamp: timestamp(),');
  lines.push('  correlationId: z.string(),');
  lines.push('  causationId: z.string().optional(),');
  lines.push('  id: z.string().optional(),');
  lines.push('});');
  lines.push('');

  lines.push("export const PROPOSER_ORIGIN = 'proposer' as const;");
  lines.push("export const NAR_ORIGIN = 'nar' as const;");
  lines.push('');

  // --- Task (schemas imported from @senars/schemas/task) ---
  lines.push('export const KernelControlStateSchema = z.enum(KERNEL_CONTROL_STATES);');
  lines.push('export type KernelControlState = z.infer<typeof KernelControlStateSchema>;');
  lines.push('');

  lines.push('export const CapabilityRiskSchema = z.enum(CAPABILITY_RISKS);');
  lines.push('export type CapabilityRisk = z.infer<typeof CapabilityRiskSchema>;');
  lines.push('');

  return lines;
}