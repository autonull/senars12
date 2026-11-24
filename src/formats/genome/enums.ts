/**
 * Enum generators for the genome.
 */

import { Defs } from './defs';

export function generateEnums(): string[] {
  const lines: string[] = [];
  lines.push('// ============================================================================');
  lines.push('// ENUMS');
  lines.push('// ============================================================================');
  lines.push('');

  // ENGINE_ORIGINS is imported from @senars/util/origins (canonical location)
  lines.push("import { ENGINE_ORIGINS, type EngineOrigin } from '@senars/util/origins';");
  // Task vocabulary imported from @senars/schemas/task (canonical location)
  lines.push("import { TASK_TYPES, TASK_BAG_KINDS, TASK_PUNCTUATIONS, TOLERANT_PUNCTUATIONS, TASK_PUNCTUATION, taskTypeForPunctuation, TaskTypeSchema, TaskBagKindSchema, TaskPunctuationSchema, TolerantPunctuationSchema, type TaskType, type TaskBagKind, type TaskPunctuation, type TolerantPunctuation } from '@senars/schemas/task';");
  lines.push('');

  for (const [name, values] of Object.entries(Defs.enums)) {
    if (name === 'ENGINE_ORIGINS') continue; // Imported from canonical location
    const typeName = name.replace(/S$/, '').replace(/_/g, '_');
    // Special case: AMBIGUITY_SEVERITIES -> AMBIGUITY_SEVERITY (not AMBIGUITY_SEVERITIE)
    const finalTypeName = name === 'AMBIGUITY_SEVERITIES' ? 'AMBIGUITY_SEVERITY' : typeName;
    lines.push(`export const ${name} = ${JSON.stringify(values, null, 2)} as const;`);
    lines.push(`export type ${finalTypeName} = (typeof ${name})[number];`);
    lines.push('');
  }

  // Re-export ENGINE_ORIGINS type for compatibility
  lines.push('export type ENGINE_ORIGIN = EngineOrigin;');
  // Re-export task vocabulary types for compatibility
  lines.push('export type TASK_TYPE = TaskType;');
  lines.push('export type TASK_BAG_KIND = TaskBagKind;');
  lines.push('export type TASK_PUNCTUATION = TaskPunctuation;');
  lines.push('export type TOLERANT_PUNCTUATION = TolerantPunctuation;');
  lines.push('');

  return lines;
}