/**
 * Kernel type schema generators for the genome.
 */

export function generateKernelSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Core kernel types (Term, Stamp, BudgetScopeId) ---');
  lines.push('export const TermOpSchema = z.enum([');
  lines.push("  'var', 'const', '-->', '<->', '==>', '<=>', '&', '|', '~', '*', '@', '#', '|>', '||', ';', '|~', '.', '?', '!'");
  lines.push(']);');
  lines.push('export type TermOp = z.infer<typeof TermOpSchema>;');
  lines.push('');

  lines.push('export const VariableTermSchema = z.object({');
  lines.push("  op: z.literal('var'),");
  lines.push('  name: z.string(),');
  lines.push('  index: nonNegativeInt(),');
  lines.push('  hash: nonNegativeInt(),');
  lines.push('  complexity: positiveInt(),');
  lines.push('});');
  lines.push('export type VariableTerm = z.infer<typeof VariableTermSchema>;');
  lines.push('');

  lines.push('export const ConstantTermSchema = z.object({');
  lines.push("  op: z.literal('const'),");
  lines.push('  value: z.string(),');
  lines.push('  hash: nonNegativeInt(),');
  lines.push('  complexity: positiveInt(),');
  lines.push('});');
  lines.push('export type ConstantTerm = z.infer<typeof ConstantTermSchema>;');
  lines.push('');

  lines.push('export const CompoundTermOpSchema = TermOpSchema.exclude([\'var\', \'const\']);');
  lines.push('export type CompoundTermOp = z.infer<typeof CompoundTermOpSchema>;');
  lines.push('');

  lines.push('export const CompoundTermSchema = z.object({');
  lines.push('  op: CompoundTermOpSchema,');
  lines.push('  args: z.array(z.lazy(() => TermSchema)),');
  lines.push('  arity: positiveInt(),');
  lines.push('  hash: nonNegativeInt(),');
  lines.push('  complexity: positiveInt(),');
  lines.push('});');
  lines.push('export type CompoundTerm = z.infer<typeof CompoundTermSchema>;');
  lines.push('');

  lines.push('export const TermSchema: z.ZodTypeAny = z.discriminatedUnion(\'op\', [');
  lines.push('  VariableTermSchema,');
  lines.push('  ConstantTermSchema,');
  lines.push('  CompoundTermSchema,');
  lines.push(']);');
  lines.push('export type Term = z.infer<typeof TermSchema>;');
  lines.push('');

  lines.push('export const StampSchema = z.object({');
  lines.push('  id: uuid(),');
  lines.push('  ts: timestamp(),');
  lines.push('  parents: z.array(uuid()),');
  lines.push('  derivation: z.array(z.string()),');
  lines.push('  evidence: z.number(),');
  lines.push('});');
  lines.push('export type Stamp = z.infer<typeof StampSchema>;');
  lines.push('');

  lines.push('export const BudgetScopeIdSchema = z.enum(BUDGET_SCOPE_IDS);');
  lines.push('export type BudgetScopeId = z.infer<typeof BudgetScopeIdSchema>;');
  lines.push('');

  lines.push('export const BudgetTypeSchema = z.enum(BUDGET_TYPES);');
  lines.push('export type BudgetType = z.infer<typeof BudgetTypeSchema>;');
  lines.push('');

  return lines;
}