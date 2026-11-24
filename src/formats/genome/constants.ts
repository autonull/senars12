/**
 * Constant generators for the genome.
 */

import { Defs } from './defs';

export function generateConstants(): string[] {
  const lines: string[] = [];
  lines.push('// ============================================================================');
  lines.push('// CONSTANTS');
  lines.push('// ============================================================================');
  lines.push('');

  for (const [name, value] of Object.entries(Defs.constants)) {
    if (name === 'DURABLE_EVENT_TYPES' || name === 'RECALLED_EVENT_TYPES') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`export const ${name} = ${JSON.stringify(value, null, 2)} as const;`);
    } else {
      lines.push(`export const ${name} = ${JSON.stringify(value)} as const;`);
    }
    lines.push('');
  }

  return lines;
}