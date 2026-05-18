import type {CommandDefinition} from './registry.js';
import type {NAR} from '../../nar/nar.js';
import type {ScenarioRunner} from '../../agent/scenarios/ScenarioRunner.js';
import type {RegressionTracker} from '../../agent/scenarios/RegressionTracker.js';

interface ExtendedNAR extends NAR {
	scenarioRunner?: ScenarioRunner;
	regressionTracker?: RegressionTracker;
}

export const benchmarkCommands: CommandDefinition[] = [
	{
		name: '.bench',
		description: 'Run benchmark suite',
		usage: '.bench run [suite]',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.scenarioRunner) return 'ScenarioRunner not available';

			const subcmd = args[0];
			if (!subcmd || subcmd === 'run') {
				const suite = args[1] || 'full';
				return `Running benchmark suite: ${suite}...\n(Note: Full benchmark implementation pending)`;
			}

			return 'Usage: .bench run [suite]';
		},
	},
	{
		name: '.bench.compare',
		description: 'Compare two benchmark runs',
		usage: '.bench compare <id1> <id2>',
		execute: async (args) => {
			if (args.length < 2) return 'Usage: .bench compare <id1> <id2>';
			return 'Benchmark comparison not yet implemented';
		},
	},
	{
		name: '.bench.baseline',
		description: 'Set current scores as baseline',
		usage: '.bench baseline',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.regressionTracker) return 'RegressionTracker not available';

			const suite = args[0];
			if (suite) {
				nar.regressionTracker.setBaseline(suite);
				return `Baseline set for suite: ${suite}`;
			}

			return 'Baseline set for all suites';
		},
	},
	{
		name: '.bench.history',
		description: 'Show benchmark history',
		usage: '.bench history [suite]',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.regressionTracker) return 'RegressionTracker not available';

			const suite = args[0];
			if (suite) {
				const history = nar.regressionTracker.getHistory(suite);
				if (history.length === 0) return `No history for suite: ${suite}`;
				return history.map(e => `${new Date(e.timestamp).toISOString()}: score=${e.score.toFixed(3)}, passed=${e.passed}, failed=${e.failed}`).join('\n');
			}

			return 'Use .bench history <suite> to view specific suite history';
		},
	},
	{
		name: '.bench.regression',
		description: 'Check for regressions',
		usage: '.bench regression [suite]',
		execute: async (args, ctx) => {
			const nar = ctx.nar as ExtendedNAR;
			if (!nar.regressionTracker) return 'RegressionTracker not available';

			const suite = args[0];
			if (!suite) return 'Usage: .bench regression <suite>';

			const regression = nar.regressionTracker.detectRegression(suite);
			if (!regression) return `No regression data for suite: ${suite}`;

			return regression.hasRegression
				? `⚠️ ${regression.message}`
				: `✅ No regression detected for ${suite}`;
		},
	},
];
