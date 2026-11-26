/**
 * `senars memory import` — Import memory from file.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { readJsonlAsync } from '@senars/util/fs';
import { createAgentFromEnv } from '../../lib/lifecycle';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'memory import',
  description: 'Import memory from file',
  usage: 'senars memory import <path> [options]',
  sections: [
    { lines: ['<path>                 Input file path (JSON or JSONL)'] },
    { lines: ['--merge                Merge with existing memory (default: replace)', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars memory import memory.json',
    'senars memory import episodes.jsonl --merge',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const inputPath = positional[0];
    const merge = flagHelpers.has(rawFlags, '--merge');

    if (!inputPath) {
      console.error('Error: <path> argument required');
      process.exit(1);
    }

    const { nar, agent } = await createAgentFromEnv();

    try {
      let imported = 0;

      if (inputPath.endsWith('.jsonl')) {
        const { rows } = await readJsonlAsync(inputPath, (value) => value as Record<string, unknown>);
        for (const row of rows) {
          if (row.type === 'episode' && row.content) {
            await nar.addEpisode?.(row.content, row.metadata ?? {}, row.type as string);
            imported++;
          }
          // Concepts and beliefs would need different handling
        }
      } else {
        // JSON format
        const { readFileSync } = await import('node:fs');
        const data = JSON.parse(readFileSync(inputPath, 'utf-8'));

        if (data.episodes) {
          for (const ep of data.episodes) {
            if (ep.content) {
              await nar.addEpisode?.(ep.content, ep.metadata ?? {}, ep.type);
              imported++;
            }
          }
        }
      }

      const output = { imported, inputPath, merge };

      if (jsonOutput) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(`Imported ${imported} items from ${inputPath}`);
      }
    } finally {
      await nar.dispose();
    }
  }, flags, 'memory import');
});

export const memoryImportModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}