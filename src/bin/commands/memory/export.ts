/**
 * `senars memory export` — Export memory to file.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { writeJsonFile, writeJsonl } from '@senars/util/fs';
import { createAgentFromEnv } from '../../lib/lifecycle';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'memory export',
  description: 'Export memory to file',
  usage: 'senars memory export [options]',
  sections: [
    { lines: ['--output <path>        Output file path (default: .cache/memory-export.json)', '--type <type>          Memory type: concepts|beliefs|episodes|all (default: all)', '--format <fmt>         Output format: json|jsonl (default: json)', '--since <date>         Only export items since date (ISO 8601)'] },
  ],
  examples: [
    'senars memory export --output memory.json',
    'senars memory export --type episodes --format jsonl',
    'senars memory export --since 2026-01-01',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const outputPath = flagHelpers.str(rawFlags, '--output', '.cache/memory-export.json');
    const type = flagHelpers.str(rawFlags, '--type', 'all');
    const format = flagHelpers.str(rawFlags, '--format', 'json');
    const since = flagHelpers.str(rawFlags, '--since', '');

    const { nar, agent } = await createAgentFromEnv();

    try {
      const data: Record<string, unknown> = {};

      if (type === 'all' || type === 'concepts') {
        data.concepts = Array.from(nar.concepts.entries()).map(([term, concept]) => ({
          term: term.toString(),
          truth: concept.truth,
          priority: concept.priority,
          usage: concept.usage,
        }));
      }

      if (type === 'all' || type === 'beliefs') {
        data.beliefs = Array.from(nar.concepts.entries())
          .filter(([, concept]) => concept.truth.f > 0 || concept.truth.c > 0)
          .map(([term, concept]) => ({
            term: term.toString(),
            frequency: concept.truth.f,
            confidence: concept.truth.c,
          }));
      }

      if (type === 'all' || type === 'episodes') {
        const episodes = await nar.getEpisodes?.({ limit: 100000 }) ?? [];
        data.episodes = since
          ? episodes.filter((e: { timestamp?: number }) => e.timestamp && e.timestamp >= new Date(since).getTime())
          : episodes;
      }

      if (format === 'jsonl') {
        const lines: Array<Record<string, unknown>> = [];
        if (data.concepts) lines.push(...(data.concepts as Array<unknown>).map(c => ({ type: 'concept', ...c } as Record<string, unknown>)));
        if (data.beliefs) lines.push(...(data.beliefs as Array<unknown>).map(b => ({ type: 'belief', ...b } as Record<string, unknown>)));
        if (data.episodes) lines.push(...(data.episodes as Array<unknown>).map(e => ({ type: 'episode', ...e } as Record<string, unknown>)));
        await writeJsonl(outputPath, lines);
      } else {
        await writeJsonFile(outputPath, data);
      }

      if (jsonOutput) {
        console.log(JSON.stringify({ outputPath, format, types: Object.keys(data), count: Object.values(data).flat().length }, null, 2));
      } else {
        console.log(`Exported memory to ${outputPath} (${format})`);
        for (const [k, v] of Object.entries(data)) {
          console.log(`  ${k}: ${(v as Array<unknown>).length} items`);
        }
      }
    } finally {
      await nar.dispose();
    }
  }, flags, 'memory export');
});

export const memoryExportModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}