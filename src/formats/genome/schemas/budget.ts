/**
 * Budget and BudgetGate schema generators for the genome.
 */

export function generateBudgetSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Reasoning budget (before BudgetGate) ---');
  lines.push('export const ConsumedBudgetSchema = z.object({');
  lines.push('  cycles: nonNegativeInt().default(0),');
  lines.push('  depth: nonNegativeInt().default(0),');
  lines.push('  memoryOps: nonNegativeInt().default(0),');
  lines.push('  llmCalls: nonNegativeInt().default(0),');
  lines.push('});');
  lines.push('export type ConsumedBudget = z.infer<typeof ConsumedBudgetSchema>;');
  lines.push('');

  lines.push('export const TerminationReasonSchema = z.enum(TERMINATION_REASONS);');
  lines.push('export type TerminationReason = z.infer<typeof TerminationReasonSchema>;');
  lines.push('');

  lines.push('export const zeroConsumed = (): ConsumedBudget => ({ cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 });');
  lines.push('');

  lines.push('export const ReasoningBudgetSchema = z.object({');
  lines.push('  maxCycles: positiveInt(),');
  lines.push('  maxDepth: positiveInt(),');
  lines.push('  maxMemoryOps: positiveInt(),');
  lines.push('  maxLMCalls: nonNegativeInt(),');
  lines.push('  wallclockDeadlineMs: positiveInt().optional(),');
  lines.push('  abortSignal: z.unknown().optional(),');
  lines.push('  terminationReason: TerminationReasonSchema.optional(),');
  lines.push('  consumed: ConsumedBudgetSchema.default(zeroConsumed),');
  lines.push('});');
  lines.push('export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;');
  lines.push('');

  // --- BudgetGate (depends on ReasoningBudgetSchema, TerminationReasonSchema) ---
  lines.push('export const BudgetGateInputSchema = z.object({');
  lines.push('  budget: ReasoningBudgetSchema.optional(),');
  lines.push('  operation: BudgetOperationSchema,');
  lines.push('  estimatedCost: positiveInt().optional(),');
  lines.push('  scopeId: z.union([z.enum(BUDGET_SCOPE_IDS), z.string()]).optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type BudgetGateInput = z.infer<typeof BudgetGateInputSchema>;');
  lines.push('');

  lines.push('export const BudgetGateOutputSchema = z.object({');
  lines.push('  granted: z.boolean(),');
  lines.push('  updatedBudget: ReasoningBudgetSchema.optional(),');
  lines.push('  terminationReason: z.enum(TERMINATION_REASONS).optional(),');
  lines.push('});');
  lines.push('export type BudgetGateOutput = z.infer<typeof BudgetGateOutputSchema>;');
  lines.push('');

  lines.push("export type GateName = 'perception' | 'action' | 'reward' | 'budget';");
  lines.push('');

  lines.push('/** The decision shape: a grant, and why not when refused. */');
  lines.push('export type Verdict<Granted extends string, Reason extends string = \'reason\'> = {');
  lines.push('  [K in Granted]: boolean;');
  lines.push('} & {');
  lines.push('  [K in Reason]?: string;');
  lines.push('};');
  lines.push('');

  lines.push("export type GateOutcome = Verdict<'granted'>;");
  lines.push('');

  // --- PerceptionGateOutput (depends on TaskAdmittedEventSchema) ---
  lines.push('export const PerceptionGateOutputSchema = z.object({');
  lines.push('  admitted: z.boolean(),');
  lines.push('  task: TaskAdmittedEventSchema.shape.payload.optional(),');
  lines.push('  rejectionReason: z.string().optional(),');
  lines.push('});');
  lines.push('export type PerceptionGateOutput = z.infer<typeof PerceptionGateOutputSchema>;');
  lines.push('');

  return lines;
}