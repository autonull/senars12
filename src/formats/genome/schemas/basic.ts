/**
 * Basic schema generators for the genome.
 */

export function generateBasicSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// ============================================================================');
  lines.push('// ZOD SCHEMAS — in dependency order');
  lines.push('// ============================================================================');
  lines.push('');

  // --- Basic schemas (no dependencies) ---
  lines.push('/** The 0..1 truth pair every event payload, derivation record, and formalization candidate carries. */');
  lines.push('export const TruthValueSchema = z.object({');
  lines.push('  frequency: unitInterval(),');
  lines.push('  confidence: unitInterval(),');
  lines.push('});');
  lines.push('export type TruthValue = z.infer<typeof TruthValueSchema>;');
  lines.push('');

  lines.push('/** Where a claim came from. Provenance is what bounds its confidence. */');
  lines.push('export const SourceQualitySchema = z.enum(SOURCE_QUALITY);');
  lines.push('export type SourceQuality = z.infer<typeof SourceQualitySchema>;');
  lines.push('');

  lines.push("/** A source's track record, as the one thing it is allowed to do to a ceiling: lower it. */");
  lines.push('export interface CeilingReputation {');
  lines.push('  effectiveCeiling(base: number, key: string): number;');
  lines.push('}');
  lines.push('');

  lines.push('export interface CeilingLimits {');
  lines.push('  reputation?: CeilingReputation;');
  lines.push('  sourceKey?: string;');
  lines.push('  atMost?: number;');
  lines.push('  scaledBy?: number;');
  lines.push('}');
  lines.push('');

  lines.push('export const confidenceCeiling = (quality: SourceQuality, limits: CeilingLimits = {}): number => {');
  lines.push('  const base = SOURCE_QUALITY_CONFIDENCE[quality];');
  lines.push('  const rated = limits.reputation && limits.sourceKey ? limits.reputation.effectiveCeiling(base, limits.sourceKey) : base;');
  lines.push('  const bounded = limits.atMost === undefined ? rated : Math.min(limits.atMost, rated);');
  lines.push('  return Math.min(1, Math.max(0, limits.scaledBy === undefined ? bounded : bounded * limits.scaledBy));');
  lines.push('};');
  lines.push('');

  // --- Common ---
  lines.push('export const RulePatternSideSchema = z.object({ op: nonEmpty() });');
  lines.push('export type RulePatternSide = z.infer<typeof RulePatternSideSchema>;');
  lines.push('');

  lines.push('export const RulePatternSchema = z.object({');
  lines.push('  left: RulePatternSideSchema,');
  lines.push('  right: RulePatternSideSchema,');
  lines.push('});');
  lines.push('export type RulePattern = z.infer<typeof RulePatternSchema>;');
  lines.push('');

  lines.push('export const BudgetSchema = z.object({');
  lines.push('  priority: unitInterval(),');
  lines.push('  durability: unitInterval(),');
  lines.push('  quality: unitInterval(),');
  lines.push('  cycles: nonNegativeInt(),');
  lines.push('  depth: nonNegativeInt(),');
  lines.push('});');
  lines.push('export type Budget = z.infer<typeof BudgetSchema>;');
  lines.push('');

  lines.push('/** One turn of conversation history. Re-exported from @senars/util. */');
  lines.push('export interface HistoryEntry {');
  lines.push("  role: 'user' | 'agent' | 'system';");
  lines.push('  content: string;');
  lines.push('  timestamp: number;');
  lines.push('}');
  lines.push('export const HistoryEntrySchema = z.object({');
  lines.push("  role: z.enum(['user', 'agent', 'system']),");
  lines.push('  content: z.string(),');
  lines.push('  timestamp: z.number().int().nonnegative(),');
  lines.push('});');
  lines.push('');

  lines.push('export const IndependenceSchema = z.enum(INDEPENDENCE);');
  lines.push('export type Independence = z.infer<typeof IndependenceSchema>;');
  lines.push('');

  return lines;
}