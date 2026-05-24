import type {CommandDefinition} from './registry.js';
import type {NAR} from '../../nar/nar.js';
import type {ReasoningAboutReasoning} from '../../nar/self/ReasoningAboutReasoning.js';

interface ExtendedNAR extends NAR {
	getSelfAnalyzer(): ReasoningAboutReasoning | undefined;
}

export const selfCommands: CommandDefinition[] = [
{
	name: '/self',
	aliases: ['.self'],
	description: 'Show self/metacognition status',
	usage: '/self',
	execute: async (_args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		const self = nar.getSelfAnalyzer();
		if (!self) return 'Self/Metacognition is not enabled';
		return `Self/Metacognition Status:\nRunning: ${'isRunning' in self ? (self as any).isRunning : 'N/A'}`;
	}
},
{
	name: '/self.analyze',
	aliases: ['.self.analyze'],
	description: 'Run self-analysis and print report',
	usage: '/self analyze',
	execute: async (_args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		const self = nar.getSelfAnalyzer();
		if (!self) return 'SelfAnalyzer not available';

		try {
			const report = await self.analyzeReasoningGaps();
			return `Self-Analysis Report:\nMissing Rules: ${report.missingRules.length}\nLow Confidence Beliefs: ${report.lowConfidenceBeliefs.length}\nRepeated Failures: ${report.repeatedFailures.length}`;
		} catch (error) {
			return `Error during analysis: ${error}`;
		}
	},
},
{
	name: '/self.propose',
	aliases: ['.self.propose'],
	description: 'Show improvement suggestions',
	usage: '/self propose',
	execute: async (_args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		const self = nar.getSelfAnalyzer();
		if (!self) return 'SelfAnalyzer not available';
		return 'Improvement proposals not available in this mode';
	},
},
{
	name: '/self.apply',
	aliases: ['.self.apply'],
	description: 'Apply suggested improvement',
	usage: '/self apply <id>',
	execute: async (args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		if (!nar.getSelfAnalyzer()) return 'SelfAnalyzer not available';

		const proposalId = args[0];
		if (!proposalId) return 'Usage: /self apply <id>\nUse /self propose to see available improvements';

		return `Improvement ${proposalId} application pending implementation`;
	},
},
    {
        name: '/meta',
        aliases: ['.meta'],
        description: 'Show meta-analysis report',
        usage: '/meta',
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
        name: '/constitution',
        aliases: ['.constitution'],
        description: 'View or add constitutional beliefs',
        usage: '/constitution [add <term>]',
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
