import type {CommandDefinition} from './index.js';
import {errMsg} from '../../nar/utils/helpers.js';

export const NARDisplayCommands: CommandDefinition[] = [
    {
        name: '.concepts',
        description: 'List concepts (optional filter)',
        usage: '.concepts [filter]',
        handler: (ctx, args) => {
            const concepts = ctx.nar.listConcepts();
            const filter = args.join(' ');
            let filtered = concepts;

            if (filter) {
                filtered = concepts.filter(c =>
                    c.term.toString().toLowerCase().includes(filter.toLowerCase())
                );
            }

            if (filtered.length === 0) {
                ctx.logger.info(filter ? `No concepts matching '${filter}'` : 'Memory is empty');
                return;
            }

            ctx.logger.info(`\nConcepts (${filtered.length} total):`);
            for (const concept of filtered.slice(0, 50)) {
                ctx.logger.info(` ${concept.term.toString()}`);
            }
            if (filtered.length > 50) {
                ctx.logger.info(` ... and ${filtered.length - 50} more`);
            }
        }
    },
    {
        name: '.rules',
        description: 'List registered inference rules',
        usage: '.rules',
        handler: (ctx) => {
            ctx.logger.info('\nRegistered Rules:');
            ctx.logger.info(' - deduction: (A --> B), (B --> C) => (A --> C)');
            ctx.logger.info(' - induction: (A --> B), (A --> C) => (C --> B)');
            ctx.logger.info(' - abduction: (A --> C), (B --> C) => (A --> B)');
            ctx.logger.info(' - revision: Merge conflicting beliefs');
            ctx.logger.info(' - LM rules: Dynamic language model inference');
        }
    },
    {
        name: '.tools',
        description: 'List available tools',
        usage: '.tools [filter]',
        handler: (ctx, args) => {
            ctx.logger.info('\nAvailable Tools:');
            const tools = ctx.nar.listTools();
            const filter = args.join(' ').toLowerCase();

            const filtered = filter
                ? tools.filter(t => t.name.toLowerCase().includes(filter))
                : tools;

            for (const tool of filtered) {
                ctx.logger.info(` - ${tool.name}: ${tool.description}`);
            }
            if (filtered.length === 0) {
                ctx.logger.info(' (none)');
            }
        }
    },
    {
        name: '.query',
        description: 'Query memory for beliefs/goals/questions',
        usage: '.query <term>',
        handler: async (ctx, args) => {
            const termStr = args.join(' ');
            if (!termStr) {
                ctx.logger.info('Usage: .query <term>');
                return;
            }

            const beliefs = ctx.nar.getBeliefs();
            const goals = ctx.nar.getGoals();
            const questions = ctx.nar.getQuestions();

            ctx.logger.info('\nQuery Results:');
            ctx.logger.info(`Beliefs: ${beliefs.length}`);
            ctx.logger.info(`Goals: ${goals.length}`);
            ctx.logger.info(`Questions: ${questions.length}`);

            const all = [...beliefs, ...goals, ...questions];
            if (all.length > 0) {
                ctx.logger.info('\nMatches:');
                all.slice(0, 10).forEach(item => {
                    const truthStr = item.truth ? ` f=${item.truth.f.toFixed(2)} c=${item.truth.c.toFixed(2)}` : '';
                    ctx.logger.info(` ${item.term.toString()} [${item.type}]${truthStr}`);
                });
                if (all.length > 10) {
                    ctx.logger.info(` ... and ${all.length - 10} more`);
                }
            }
        }
    },
    {
        name: '.trace',
        description: 'Show derivation trace',
        usage: '.trace <term>',
        handler: async (ctx, args) => {
            const termStr = args.join(' ');
            if (!termStr) {
                ctx.logger.info('Usage: .trace <term>');
                return;
            }

            try {
                const beliefs = ctx.nar.getBeliefs({contains: termStr});
                if (beliefs.length === 0) {
                    ctx.logger.info(`No beliefs found for: ${termStr}`);
                    return;
                }

                const matchingConcept = ctx.nar.listConcepts().find(c => c.term.toString().includes(termStr));
                const term = matchingConcept?.term;
                if (!term) {
                    ctx.logger.info(`No term found for: ${termStr}`);
                    return;
                }

                const trace = ctx.nar.traceTerm(term);
                if (!trace || (Array.isArray(trace) ? trace.length : 0) === 0) {
                    ctx.logger.info(`No derivation trace found for: ${termStr}`);
                    return;
                }

                const traceArray = Array.isArray(trace) ? trace : [trace];
                ctx.logger.info('\nDerivation Trace:');
                traceArray.slice(-10).forEach((step, index) => {
                    const stepRef = step as {stamp?: {source?: string}; term?: {toString?: () => string}};
                    const source = stepRef.stamp?.source ? 'DERIVED' : 'INPUT';
                    const displayTerm = stepRef.term?.toString?.() ?? 'unknown';
                    ctx.logger.info(`${index + 1}. ${displayTerm} [${source}]`);
                });

                if (traceArray.length > 10) {
                    ctx.logger.info(` ... and ${traceArray.length - 10} more steps`);
                }
            } catch (error) {
                ctx.logger.error(`Trace error: ${errMsg(error)}`);
            }
        }
    },
    {
        name: '.explain',
        description: 'Explain how a belief was derived',
        usage: '.explain <term>',
        handler: async (ctx, args) => {
            const termStr = args.join(' ');
            if (!termStr) {
                ctx.logger.info('Usage: .explain <term>');
                return;
            }

            try {
                const beliefs = ctx.nar.getBeliefs({contains: termStr});
                if (beliefs.length === 0) {
                    ctx.logger.info(`No beliefs found for: ${termStr}`);
                    return;
                }

                const topBelief = beliefs[0]!;
                const explanation = ctx.nar.explain(topBelief);

                ctx.logger.info('\nExplanation:');
                ctx.logger.info(`Term: ${topBelief.term.toString()}`);
                ctx.logger.info(`Type: ${topBelief.type}`);
                ctx.logger.info(`Truth: f=${topBelief.truth.f.toFixed(2)}, c=${topBelief.truth.c.toFixed(2)}`);
                ctx.logger.info(`Source: ${topBelief.stamp?.source || 'DERIVED'}`);

                if (explanation) {
                    ctx.logger.info('\nDerivation path:');
                    if (Array.isArray(explanation)) {
                        explanation.slice(-5).forEach((step, i) => {
                            ctx.logger.info(` ${i + 1}. ${typeof step === 'string' ? step : step.toString()}`);
                        });
                    } else {
                        ctx.logger.info(` ${explanation}`);
                    }
                } else {
                    ctx.logger.info(' (No derivation path available)');
                }
            } catch (error) {
                ctx.logger.error(`Explain error: ${errMsg(error)}`);
            }
        }
    }
];