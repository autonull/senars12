import type {CommandDefinition} from './index.js';
import {requireArgs} from './index.js';
import {DOMAIN_LIST, DOMAINS} from '../domains.js';
import {box} from '../display.js';
import {termParser} from '../../nar/terms';

export const MemoryCommands: CommandDefinition[] = [
    {
        name: '.load',
        description: 'Load beliefs from file',
        usage: '.load <filename>',
        handler: async (ctx, args) => {
            if (!requireArgs(ctx, args, '.load <filename>')) return;
            const filename = args[0]!;

            try {
                const content = await import('fs').then(fs => fs.promises.readFile(filename, 'utf-8'));
                const lines = content.split('\n');
                let loaded = 0;

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith(';')) {
                        await ctx.nar.input(trimmed);
                        loaded++;
                    }
                }

                ctx.logger.info(`✓ Loaded ${loaded} belief(s) from ${filename}`);
            } catch (error) {
                ctx.logger.error(`Failed to load file: ${error}`);
            }
        }
    },
    {
        name: '.save',
        description: 'Save memory to file',
        usage: '.save <filename>',
        handler: async (ctx, args) => {
            if (!requireArgs(ctx, args, '.save <filename>')) return;
            const filename = args[0]!;

            try {
                const concepts = ctx.nar.listConcepts().map(c => ({
                    term: c.term.toString(),
                    beliefs: c.beliefBag?.toArray() || [],
                    goals: c.goalBag?.toArray() || []
                }));

                const data = {
                    concepts,
                    timestamp: new Date().toISOString(),
                    statistics: ctx.nar.getStatistics()
                };

                const fs = await import('fs');
                await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
                ctx.logger.info(`✓ Saved ${concepts.length} concept(s) to ${filename}`);
            } catch (error) {
                ctx.logger.error(`Failed to save: ${error}`);
            }
        }
    },
    {
        name: '.load-domain',
        description: 'Load sample domain',
        usage: '.load-domain <domain>',
        handler: (ctx, args) => {
            if (!requireArgs(ctx, args, '.load-domain <domain>')) return;
            const domain = args[0]!.toLowerCase();
            if (!DOMAINS[domain]) {
                ctx.logger.info(`Available domains: ${DOMAIN_LIST}`);
                return;
            }

            ctx.nar.loadDomain({name: domain, beliefs: DOMAINS[domain]});
            ctx.logger.info(`✓ Loaded ${domain} domain with ${DOMAINS[domain].length} beliefs`);
        }
    },
    {
        name: '.constitution',
        description: 'View or add constitutional beliefs',
        usage: '.constitution [add <belief>]',
        handler: (ctx, args) => {
            if (args[0] === 'add' && args[1]) {
                const termStr = args.slice(1).join(' ');
                const term = termParser.parse(termStr);
                ctx.nar.setConstitution([{
                    term,
                    type: 'belief' as const,
                    truth: {f: 1, c: 1},
                    budget: {priority: 1, durability: 1, quality: 1, cycles: 0, depth: 0},
                    stamp: {id: '', creationTime: Date.now(), source: 'CONSTITUTION' as const, derivations: [], depth: 0},
                    occurrenceTime: Date.now(),
                    derived: false
                }]);
                ctx.logger.info(`✓ Added to constitution: ${termStr}`);
                return;
            }

            const constitution = ctx.nar.getConstitution() ?? [];
            const lines = constitution.length === 0
                ? ['No constitution set.']
                : constitution.slice(0, 10).map(b => b.term.toString());

            ctx.logger.info('\n' + box('Constitution (Immutable Beliefs)', lines) + '\n');
            ctx.logger.info('Usage: .constitution add <narsese-belief>');
        }
    },
    {
        name: '.attention',
        description: 'Show attention allocation report',
        usage: '.attention',
        handler: (ctx) => {
            const report = ctx.nar.attentionReport();

            const lines: string[] = [
                `Total Concepts: ${String(report.total)}`,
                ...report.concepts.slice(0, 10).map((c: { term: string; priority: number }) =>
                    `${c.term.substring(0, 40).padEnd(40)} ${c.priority.toFixed(3)}`
                )
            ];

            ctx.logger.info('\n' + box('Attention Allocation', lines) + '\n');
        }
    }
];