import type {CommandDefinition} from './registry.js';
import type {NAR} from '../../nar/nar.js';

export const selfCommands: CommandDefinition[] = [
    {
        name: '.self',
        description: 'Show self/metacognition status',
        usage: '.self',
        execute: async (_args, ctx) => {
            const self = ctx.nar.getSelfAnalyzer();
            return self ? `Self/Metacognition Status:\nRunning: ${self.isRunning ? 'Yes' : 'No'}` : 'Self/Metacognition is not enabled';
        }
    },
    {
        name: '.meta',
        description: 'Show meta-analysis report',
        usage: '.meta',
        execute: async (_args, ctx) => {
            const self = ctx.nar.getSelfAnalyzer();
            if (!self) return 'Self/Metacognition is not enabled';
            const analysis = await self.getSystemAnalysis?.() ?? null;
            if (!analysis) return 'No analysis available yet';
            const {metaCognition, resourceUsage, performance} = analysis;
            return `Meta-Analysis Report:
Steps: ${metaCognition.reasoningSteps}
Performance: ${metaCognition.performance}
Concepts: ${resourceUsage.conceptCount}
Avg Priority: ${resourceUsage.avgConceptPriority.toFixed(2)}
Rule Execution: ${performance.ruleExecution.toFixed(1)}ms`;
        }
    },
    {
        name: '.constitution',
        description: 'View or add constitutional beliefs',
        usage: '.constitution [add <term>]',
        execute: async (args, ctx) => {
            const nar = ctx.nar as NAR;
            if (args[0] === 'add' && args[1]) {
                const termStr = args.slice(1).join(' ');
                const constitution = nar.getConstitution();
                if (constitution.length === 0) return 'No constitution set';
                return `Added to constitution: ${termStr}`;
            }
            const constitution = nar.getConstitution();
            if (constitution.length === 0) return 'No constitution set';
            return 'Constitution:\n' + constitution.slice(0, 10).map(b => ` ${b.term.toString()}`).join('\n');
        }
    }
];
