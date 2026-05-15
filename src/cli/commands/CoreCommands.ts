import type {CommandDefinition} from './index.js';
import {box} from '../display.js';
import {getGlobalTracer} from '../../nar/trace/index.js';

export const CoreCommands: CommandDefinition[] = [
    {
        name: '.stack',
        description: 'Show current input trace stack',
        usage: '.stack',
        handler: (_ctx, _args) => {
            const tracer = getGlobalTracer();
            _ctx.logger.info('\n' + tracer.formatTrace() + '\n');
        }
    },
    {
        name: '.help',
        description: 'Show help information',
        usage: '.help [command]',
        handler: (_ctx, _args) => {
            _ctx.logger.info('\n' + box('SeNARS CLI Commands', [
                '(term).            Add belief',
                '(term)?            Ask question',
                '{ ... }.           Multi-line input',
                '.run [n]           Run n inference steps',
                '.stats [detail]    Show statistics',
                '.concepts [f]      List concepts (filter)',
                '.rules             List registered rules',
                '.tools [f]         List available tools',
                '.query <term>      Query memory',
                '.trace <term>      Show derivation history',
                '.explain <term>    Explain why derived',
                '.config [k] [v]    View/set config',
                '.clear             Clear memory',
                '.load <file>       Load Narsese file',
                '.save <file>       Save memory to JSON',
                '.self              Show self status',
                '.meta              Show meta-analysis',
                '.optimize          Apply optimizations',
                '.prefer A B        Record A > B preference',
                '.lm-status         Show LM status',
                '.lm-switch <m>     Switch LM model',
                '.ask-nl <q>        Natural language query',
                '.constitution      View/add constitutional beliefs',
                '.attention         Show attention allocation',
                '.load-domain <d>   Load sample domain',
                '.quit              Exit',
            ]) + '\n');
        }
    },
    {
        name: '.run',
        description: 'Run inference steps',
        usage: '.run [n]',
        handler: async (ctx, args) => {
            const steps = args[0] ? parseInt(args[0]) : 5;
            ctx.logger.info(`⟳ Running ${steps} step(s)...`);
            const derived = await ctx.nar.run(steps);
            ctx.logger.info(`✓ Completed ${steps} step(s), derived ${derived} belief(s)`);
        }
    },
    {
        name: '.stats',
        description: 'Show system statistics',
        usage: '.stats [detail]',
        handler: (ctx, args) => {
            const stats = ctx.nar.getStatistics();
            ctx.logger.info(`Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`);

            if (args[0] === 'detail' || args[0] === 'all') {
                const metrics = ctx.nar.getMetrics?.();
                if (metrics) {
                    const ruleExecs = metrics.rules?.reduce((sum, r) => sum + r.executions, 0) ?? 0;
                    const derivs = metrics.system?.totalDerivations ?? 0;
                    ctx.logger.info(`Rule Executions: ${ruleExecs}, Derivations: ${derivs}`);
                }
            }
        }
    },
    {
        name: '.list',
        description: 'List all concepts',
        usage: '.list',
        handler: (ctx) => {
            const concepts = ctx.nar.listConcepts();
            if (concepts.length === 0) {
                ctx.logger.info('Memory is empty');
                return;
            }
            ctx.logger.info(`\nConcepts (${concepts.length} total):`);
            for (const concept of concepts.slice(0, 20)) {
                ctx.logger.info(` - ${concept.term.toString()}`);
            }
            if (concepts.length > 20) {
                ctx.logger.info(` ... and ${concepts.length - 20} more`);
            }
        }
    },
    {
        name: '.clear',
        description: 'Clear all memory',
        usage: '.clear',
        handler: (ctx) => {
            ctx.nar.clearMemory();
            ctx.logger.info('✓ Memory cleared');
        }
    },
    {
        name: '.quit',
        description: 'Exit the CLI',
        usage: '.quit',
        handler: () => {
            process.exit(0);
        }
    }
];