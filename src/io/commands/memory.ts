import type {CommandContext, CommandDefinition} from './registry.js';
import {singleArgCmd} from './utils.js';

export const memoryCommands: CommandDefinition[] = [
    {
        name: '.list',
        description: 'List all concepts',
        usage: '.list',
        execute: async (_args, ctx) => {
            const concepts = ctx.nar.listConcepts();
            if (concepts.length === 0) return 'Memory is empty';
            let result = `Concepts (${concepts.length} total):\n`;
            for (const concept of concepts.slice(0, 20)) {
                result += ` - ${concept.term.toString()}\n`;
            }
            if (concepts.length > 20) result += ` ... and ${concepts.length - 20} more`;
            return result.trim();
        }
    },
    {
        name: '.save',
        description: 'Save memory to file',
        usage: '.save <filename>',
        execute: singleArgCmd('.save <filename>', async (filename, ctx) => {
            const concepts = ctx.nar.listConcepts().map(c => {
                const cAny = c as any;
                return {term: c.term.toString(), beliefs: cAny.beliefBag?.toArray?.() || [], goals: cAny.goalBag?.toArray?.() || []};
            });
            const data = {concepts, timestamp: new Date().toISOString(), statistics: ctx.nar.getStatistics()};
            const fs = await import('fs');
            await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
            return `Saved ${concepts.length} concept(s) to ${filename}`;
        })
    },
    {
        name: '.load',
        description: 'Load beliefs from file',
        usage: '.load <filename>',
        execute: singleArgCmd('.load <filename>', async (filename, ctx) => {
            try {
                const fs = await import('fs');
                const content = await fs.promises.readFile(filename, 'utf-8');
                let loaded = 0;
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith(';')) {
                        await ctx.nar.input(trimmed);
                        loaded++;
                    }
                }
                return `Loaded ${loaded} belief(s) from ${filename}`;
            } catch (error) {
                return `Failed to load: ${error}`;
            }
        })
    }
];
