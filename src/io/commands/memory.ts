import type { CommandDefinition } from './registry.js';
import { requireNar, singleArgCmd } from './utils.js';

export const memoryCommands: CommandDefinition[] = [
  {
    name: '/list',
    aliases: ['.list'],
    description: 'List all concepts',
    usage: '/list',
    execute: async (_args, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      const concepts = nar.nar.listConcepts();
      if (concepts.length === 0) return 'Memory is empty';
      let result = `Concepts (${concepts.length} total):\n`;
      for (const concept of concepts.slice(0, 20)) {
        result += ` - ${concept.term.toString()}\n`;
      }
      if (concepts.length > 20) result += ` ... and ${concepts.length - 20} more`;
      return result.trim();
    },
  },
  {
    name: '/concepts',
    aliases: ['.concepts'],
    description: 'List concepts with optional filter',
    usage: '/concepts [filter]',
    execute: async (args, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      const filter = args.join(' ').toLowerCase();
      const concepts = nar.nar.listConcepts();
      if (concepts.length === 0) return 'Memory is empty';

      const filtered = filter
        ? concepts.filter((c) => c.term.toString().toLowerCase().includes(filter))
        : concepts;

      if (filtered.length === 0) {
        return `No concepts match filter: "${filter}"`;
      }

      let result = `Concepts (${filtered.length}/${concepts.length}):\n`;
      for (const concept of filtered.slice(0, 20)) {
        result += ` - ${concept.term.toString()}\n`;
      }
      if (filtered.length > 20) result += ` ... and ${filtered.length - 20} more`;
      return result.trim();
    },
  },
  {
    name: '/save',
    aliases: ['.save'],
    description: 'Save memory to file',
    usage: '/save <filename>',
    execute: singleArgCmd('/save <filename>', async (filename, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      const concepts = nar.nar.listConcepts().map((c) => {
        const cAny = c as any;
        return {
          term: c.term.toString(),
          beliefs: cAny.beliefBag?.toArray?.() || [],
          goals: cAny.goalBag?.toArray?.() || [],
        };
      });
      const data = {
        concepts,
        timestamp: new Date().toISOString(),
        statistics: nar.nar.getStatistics(),
      };
      const fs = await import('fs');
      await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
      return `Saved ${concepts.length} concept(s) to ${filename}`;
    }),
  },
  {
    name: '/load',
    aliases: ['.load'],
    description: 'Load beliefs from file',
    usage: '/load <filename>',
    execute: singleArgCmd('/load <filename>', async (filename, ctx) => {
      const nar = requireNar(ctx);
      if (!nar.ok) return nar.message;
      try {
        const fs = await import('fs');
        const content = await fs.promises.readFile(filename, 'utf-8');
        let loaded = 0;
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith(';')) {
            await nar.nar.input(trimmed);
            loaded++;
          }
        }
        return `Loaded ${loaded} belief(s) from ${filename}`;
      } catch (error) {
        return `Failed to load: ${error}`;
      }
    }),
  },
];
