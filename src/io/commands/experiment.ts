import type {CommandDefinition} from './registry.js';
import type {NAR} from '../../nar/nar.js';
import type {ExperimentRunner} from '../../agent/experiments/ExperimentRunner.js';

interface ExtendedNAR extends NAR {
	experimentRunner?: ExperimentRunner;
}

export const experimentCommands: CommandDefinition[] = [
	{
		name: '/experiment',
		aliases: ['.experiment'],
		description: 'Create or run experiment',
		usage: '/experiment <create|run|list|results|cancel> [args]',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const subcmd = args[0];
			if (!subcmd) {
				return 'Usage: /experiment <create|run|list|results|cancel>\nUse /experiment list to see all experiments';
			}

			return `Experiment command: ${subcmd} (implementation pending)`;
		},
	},
	{
		name: '/experiment.create',
		aliases: ['.experiment.create'],
		description: 'Create new experiment',
		usage: '/experiment create <type>',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const type = args[0];
			if (!type) return 'Usage: /experiment create <type>\nTypes: parameter-sweep, prompt-ab, hypothesis-test, knowledge-injection, tool-composition, strategy-comparison, adversarial-test, stress-test';

			const name = args.slice(1).join(' ') || `${type}-${Date.now()}`;
			const config = {
				type: type as any,
				name,
				description: `Experiment of type ${type}`,
			};

			const experiment = nar.experimentRunner.createExperiment(config);
			return `Created experiment: ${experiment.id}\nName: ${experiment.name}\nType: ${experiment.type}\nStatus: ${experiment.status}`;
		},
	},
	{
		name: '/experiment.run',
		aliases: ['.experiment.run'],
		description: 'Run experiment',
		usage: '/experiment run <id>',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const experimentId = args[0];
			if (!experimentId) return 'Usage: /experiment run <id>';

			const result = await nar.experimentRunner.runExperiment(experimentId);
			if (!result) return `Failed to run experiment: ${experimentId}`;

			return `Experiment ${experimentId} completed:\nScore: ${result.score.toFixed(3)}\nDuration: ${result.duration}ms`;
		},
	},
	{
		name: '/experiment.list',
		aliases: ['.experiment.list'],
		description: 'List experiments',
		usage: '/experiment list [status]',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const status = args[0];
			const experiments = nar.experimentRunner.listExperiments(status);

			if (experiments.length === 0) {
				return status
					? `No experiments with status: ${status}`
					: 'No experiments created yet. Use /experiment create <type>';
			}

			return experiments.map(e => `${e.id}: ${e.name} (${e.type}) - ${e.status}`).join('\n');
		},
	},
	{
		name: '/experiment.results',
		aliases: ['.experiment.results'],
		description: 'Show experiment results',
		usage: '/experiment results <id>',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const experimentId = args[0];
			if (!experimentId) return 'Usage: /experiment results <id>';

			const experiment = nar.experimentRunner.getExperiment(experimentId);
			if (!experiment) return `Experiment not found: ${experimentId}`;
			if (!experiment.results) return `Experiment ${experimentId} has no results yet (status: ${experiment.status})`;

			return `Experiment: ${experiment.name}\nStatus: ${experiment.results ? 'completed' : experiment.status}\nScore: ${experiment.results.score.toFixed(3)}\nDuration: ${experiment.results.duration}ms\nDetails: ${JSON.stringify(experiment.results.details, null, 2)}`;
		},
	},
	{
		name: '/experiment.cancel',
		aliases: ['.experiment.cancel'],
		description: 'Cancel running experiment',
		usage: '/experiment cancel <id>',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.experimentRunner) return 'ExperimentRunner not available';

			const experimentId = args[0];
			if (!experimentId) return 'Usage: /experiment cancel <id>';

			nar.experimentRunner.cancelExperiment(experimentId);
			return `Experiment ${experimentId} cancelled`;
		},
	},
];
