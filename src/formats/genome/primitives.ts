/**
 * Primitive generators for the genome.
 * 
 * NOTE: These are inlined zod schemas for the generated code to be self-contained.
 * The canonical definitions live in config/boundary.ts — keep them in sync.
 */

export function generatePrimitives(): string[] {
  const lines: string[] = [];
  lines.push('// ============================================================================');
  lines.push('// PRIMITIVES — inlined for self-contained generated code');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push('// Canonical source: src/config/boundary.ts');
  lines.push('');

  const primitives = [
    ['uuid', 'z.string().uuid()'],
    ['nonEmpty', 'z.string().min(1)'],
    ['nonNegativeInt', 'z.number().int().nonnegative()'],
    ['positiveInt', 'z.number().int().positive()'],
    ['unitInterval', 'z.number().min(0).max(1)'],
    ['signedUnitInterval', 'z.number().min(-1).max(1)'],
    ['timestamp', 'z.number().int().positive()'],
  ] as const;

  for (const [name, code] of primitives) {
    lines.push(`export const ${name} = () => ${code};`);
  }
  lines.push('');

  // Type aliases for primitive validators
  lines.push('/** UUID string (RFC 4122). */');
  lines.push('export type UUID = string;');
  lines.push('/** Unix timestamp in milliseconds. */');
  lines.push('export type TimestampMs = number;');
  lines.push('');

  return lines;
}