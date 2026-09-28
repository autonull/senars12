import type { CommandDefinition } from '@senars/core/command-types';
import { promises as fs } from 'node:fs';
import { writeJsonFile } from '@senars/util';

const CONCEPT_PREVIEW_LIMIT = 20;

/** `Concepts (n shown[/total]):` block, truncated with an explicit remainder count. */
const renderConcepts = (concepts: unknown[], shown = concepts.length): string => {
  const lines = concepts
    .slice(0, CONCEPT_PREVIEW_LIMIT)
    .map((c) => ` - ${(c as { term: { toString(): string } }).term}`);
  const header =
    shown === concepts.length
      ? `Concepts (${concepts.length} total):`
      : `Concepts (${shown}/${concepts.length}):`;
  if (concepts.length > CONCEPT_PREVIEW_LIMIT) {
    lines.push(` ... and ${concepts.length - CONCEPT_PREVIEW_LIMIT} more`);
  }
  return [header, ...lines].join('\n');
};

export const memoryCommands: CommandDefinition[] = [
  {
    name: '/list',
    aliases: ['.list'],
    description: 'List all concepts',
    usage: '/list',
    execute: async (_args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const concepts = nar.listConcepts();
      if (concepts.length === 0) return 'Memory is empty';
      return renderConcepts(concepts);
    },
  },
  {
    name: '/concepts',
    aliases: ['.concepts'],
    description: 'List concepts with optional filter',
    usage: '/concepts [filter]',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const filter = args.join(' ').toLowerCase();
      const concepts = nar.listConcepts();
      if (concepts.length === 0) return 'Memory is empty';

      const filtered = filter
        ? concepts.filter((c: any) => c.term.toString().toLowerCase().includes(filter))
        : concepts;

      if (filtered.length === 0) {
        return `No concepts match filter: "${filter}"`;
      }

      return renderConcepts(filtered);
    },
  },
  {
    name: '/save',
    aliases: ['.save'],
    description: 'Save memory to file',
    usage: '/save <filename>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const filename = args[0];
      if (!filename) return 'Usage: /save <filename>';
      const concepts = nar.listConcepts().map((c: any) => ({
        term: c.term.toString(),
        beliefs: c.beliefBag?.toArray?.() || [],
        goals: c.goalBag?.toArray?.() || [],
      }));
      const data = {
        concepts,
        timestamp: new Date().toISOString(),
        statistics: nar.getStatistics(),
      };
      await writeJsonFile(filename, data);
      return `Saved ${concepts.length} concept(s) to ${filename}`;
    },
  },
  {
    name: '/load',
    aliases: ['.load'],
    description: 'Load beliefs from file',
    usage: '/load <filename>',
    execute: async (args, ctx) => {
      const nar = (ctx as any).nar;
      if (!nar) return 'NAR not configured';
      const filename = args[0];
      if (!filename) return 'Usage: /load <filename>';
      try {
        const content = await fs.readFile(filename, 'utf-8');
        let loaded = 0;
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith(';')) {
            await nar.input(trimmed);
            loaded++;
          }
        }
        return `Loaded ${loaded} belief(s) from ${filename}`;
      } catch (error) {
        return `Failed to load: ${error}`;
      }
    },
  },
];
