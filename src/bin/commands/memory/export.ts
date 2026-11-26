/**
 * `senars memory export` — Export memory to file.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { writeJsonFile, writeJsonl } from '@senars/util/fs';
import { createAgentFromEnv } from '../../lib/lifecycle';

const logger = createLogger({ scope: 'memory:export' });

export const sections: HelpSection[] = [
  standardSections.usage('senars memory export', 'Export memory to file'),
  {
    title: 'Options',
    lines: [
      '--output <path>        Output file path (default: .cache/memory-export.json)',
      '--type <type>          Memory type: concepts|beliefs|episodes|all (default: all)',
      '--format <fmt>         Output format: json|jsonl (default: json)',
      '--since <date>         Only export items since date (ISO 8601)',
    ],
  },
  standardSections.examples([
    'senars memory export --output memory.json',
    'senars memory export --type episodes --format jsonl',
    'senars memory export --since 2026-01-01',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const outputPath = argv.str('--output', '.cache/memory-export.json');
  const type = argv.str('--type', 'all');
  const format = argv.str('--format', 'json');
  const since = argv.str('--since');

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}