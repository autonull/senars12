/**
 * `senars memory inspect` — Inspect memory (concepts, beliefs, episodes).
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';
import { createAgentFromEnv } from '../../lib/lifecycle';

const logger = createLogger({ scope: 'memory:inspect' });

export const sections: HelpSection[] = [
  standardSections.usage('senars memory inspect', 'Inspect memory'),
  {
    title: 'Options',
    lines: [
      '--type <type>          Memory type: concepts|beliefs|episodes|all (default: all)',
      '--limit <n>            Maximum items to show (default: 50)',
      '--search <query>       Search/filter results',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars memory inspect',
    'senars memory inspect --type concepts --limit 20',
    'senars memory inspect --search "animal" --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const type = argv.str('--type', 'all');
  const limit = parseInt(argv.str('--limit', '50'), 10);
  const search = argv.str('--search');

  const { nar, agent } = await createAgentFromEnv();

  try {
    const output: Record<string, unknown> = {};

    if (type === 'all' || type === 'concepts') {
      const concepts = nar.listConcepts?.() ?? [];
      output.concepts = concepts
        .slice(0, limit)
        .map((c: { term: unknown; truth: { f: number; c: number }; priority: number; usage: number }) => ({
          term: c.term.toString(),
          truth: c.truth,
          priority: c.priority,
          usage: c.usage,
        }));
      if (search) {
        output.concepts = (output.concepts as Array<{ term: string }>).filter((c) => c.term.toLowerCase().includes(search.toLowerCase()));
      }
    }

    if (type === 'all' || type === 'beliefs') {
      // Beliefs are derived from concepts with truth values
      const concepts = nar.listConcepts?.() ?? [];
      const beliefs = concepts
        .filter((c: { truth: { f: number; c: number } }) => c.truth.f > 0 || c.truth.c > 0)
        .slice(0, limit)
        .map((c: { term: unknown; truth: { f: number; c: number } }) => ({
          term: c.term.toString(),
          frequency: c.truth.f,
          confidence: c.truth.c,
        }));
      output.beliefs = search
        ? beliefs.filter((b: { term: string }) => b.term.toLowerCase().includes(search.toLowerCase()))
        : beliefs;
    }

    if (type === 'all' || type === 'episodes') {
      const episodes = await nar.getEpisodes?.({ limit }) ?? [];
      output.episodes = search
        ? episodes.filter((e: { content?: string }) => e.content?.toLowerCase().includes(search.toLowerCase()))
        : episodes;
    }

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('=== Memory Inspection ===\n');
      if (output.concepts) {
        console.log(`--- Concepts (${(output.concepts as Array<unknown>).length}) ---`);
        for (const c of output.concepts as Array<{ term: string; truth: { f: number; c: number }; priority: number }>) {
          console.log(`  ${c.term}  f=${c.truth.f.toFixed(2)} c=${c.truth.c.toFixed(2)} p=${c.priority.toFixed(2)}`);
        }
      }
      if (output.beliefs) {
        console.log(`\n--- Beliefs (${(output.beliefs as Array<unknown>).length}) ---`);
        for (const b of output.beliefs as Array<{ term: string; frequency: number; confidence: number }>) {
          console.log(`  ${b.term}  f=${b.frequency.toFixed(2)} c=${b.confidence.toFixed(2)}`);
        }
      }
      if (output.episodes) {
        console.log(`\n--- Episodes (${(output.episodes as Array<unknown>).length}) ---`);
        for (const e of output.episodes as Array<{ type?: string; content?: string; timestamp?: number }>) {
          const time = e.timestamp ? new Date(e.timestamp).toISOString() : 'unknown';
          console.log(`  [${e.type ?? '?'}] ${time}  ${String(e.content ?? '').slice(0, 80)}`);
        }
      }
    }
  } finally {
    await nar.dispose();
  }
}

export const memoryInspectModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}