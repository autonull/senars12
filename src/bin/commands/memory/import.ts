/**
 * `senars memory import` — Import memory from file.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { readJsonlAsync } from '@senars/util/fs';
import { createAgentFromEnv } from '../../lib/lifecycle';

const logger = createLogger({ scope: 'memory:import' });

export const sections: HelpSection[] = [
  standardSections.usage('senars memory import', 'Import memory from file'),
  {
    title: 'Arguments',
    lines: [
      '<path>                 Input file path (JSON or JSONL)',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--merge                Merge with existing memory (default: replace)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars memory import memory.json',
    'senars memory import episodes.jsonl --merge',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const inputPath = positional[0];
  const merge = argv.has('--merge');

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}