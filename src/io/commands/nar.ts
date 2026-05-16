import type {CommandDefinition} from './registry.js';

export const narCommands: CommandDefinition[] = [
    {
        name: '.query',
        description: 'Query memory for beliefs/goals/questions',
        usage: '.query <term>',
        execute: async (args, ctx) => {
            const termStr = args.join(' ');
            if (!termStr) return 'Usage: .query <term>';
            const beliefs = ctx.nar.getBeliefs();
            const goals = ctx.nar.getGoals();
            const questions = ctx.nar.getQuestions();
            let result = `Query Results:\nBeliefs: ${beliefs.length}\nGoals: ${goals.length}\nQuestions: ${questions.length}`;
            const all = [...beliefs, ...goals, ...questions];
            if (all.length > 0) {
                result += '\nMatches:';
                all.slice(0, 10).forEach(item => {
                    const truthStr = item.truth ? ` f=${item.truth.f.toFixed(2)} c=${item.truth.c.toFixed(2)}` : '';
                    result += `\n ${item.term.toString()} [${item.type}]${truthStr}`;
                });
                if (all.length > 10) result += `\n ... and ${all.length - 10} more`;
            }
            return result;
        }
    },
    {
        name: '.trace',
        description: 'Show derivation trace',
        usage: '.trace <term>',
        execute: async (args, ctx) => {
            const termStr = args.join(' ');
            if (!termStr) return 'Usage: .trace <term>';
            try {
                const beliefs = ctx.nar.getBeliefs({contains: termStr});
                if (beliefs.length === 0) return `No beliefs found for: ${termStr}`;
                const matchingConcept = ctx.nar.listConcepts().find(c => c.term.toString().includes(termStr));
                const term = matchingConcept?.term;
                if (!term) return `No term found for: ${termStr}`;
                const trace = ctx.nar.traceTerm(term);
                if (!trace || (Array.isArray(trace) ? trace.length : 0) === 0) return `No derivation trace found for: ${termStr}`;
                let result = 'Derivation Trace:';
                const traceArray = Array.isArray(trace) ? trace : [trace];
                traceArray.slice(-10).forEach((step, index) => {
                    const displayTerm = (step as {term?: {toString?: () => string}})?.term?.toString?.() ?? 'unknown';
                    result += `\n${index + 1}. ${displayTerm}`;
                });
                if (traceArray.length > 10) result += `\n ... and ${traceArray.length - 10} more steps`;
                return result;
            } catch (error) {
                return `Trace error: ${error}`;
            }
        }
    },
    {
        name: '.explain',
        description: 'Explain how a belief was derived',
        usage: '.explain <term>',
        execute: async (args, ctx) => {
            const termStr = args.join(' ');
            if (!termStr) return 'Usage: .explain <term>';
            try {
                const beliefs = ctx.nar.getBeliefs({contains: termStr});
                if (beliefs.length === 0) return `No beliefs found for: ${termStr}`;
                const topBelief = beliefs[0];
                if (!topBelief) return `No beliefs found for: ${termStr}`;
                const explanation = ctx.nar.explain(topBelief);
                let result = `Explanation:\nTerm: ${topBelief.term.toString()}\nType: ${topBelief.type}\nTruth: f=${topBelief.truth.f.toFixed(2)}, c=${topBelief.truth.c.toFixed(2)}\nSource: ${topBelief.stamp?.source || 'DERIVED'}`;
                if (explanation) {
                    result += '\nDerivation path:';
                    if (Array.isArray(explanation)) {
                        explanation.slice(-5).forEach((step, i) => {
                            result += `\n ${i + 1}. ${typeof step === 'string' ? step : step.toString()}`;
                        });
                    } else {
                        result += `\n ${explanation}`;
                    }
                }
                return result;
            } catch (error) {
                return `Explain error: ${error}`;
            }
        }
    }
];
