import type {CommandDefinition} from './registry.js';
import type {NAR} from '../../nar/nar.js';
import type {SelfAnalyzer} from '../../nar/self/SelfAnalyzer.js';
import type {ScenarioRunner} from '../../agent/scenarios/ScenarioRunner.js';

interface ExtendedNAR extends NAR {
	selfAnalyzer?: SelfAnalyzer;
	scenarioRunner?: ScenarioRunner;
	orchestrationGuide?: {
		evaluate: (truth: {f: number; c: number}) => string;
		expectation: (truth: {f: number; c: number}) => number;
		calibrateLLMConfidence: (truth: {f: number; c: number}) => {f: number; c: number};
	};
	groundingPipeline?: {
		add?: (fact: string, source: string) => void;
		query?: (query: string) => string[];
	};
}

export const scenarioCommands: CommandDefinition[] = [
{
	name: '/scenario',
	aliases: ['.scenario'],
	description: 'Run or list scenarios',
	usage: '/scenario <run|list|run-batch> [args]',
	execute: async (args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		if (!nar.scenarioRunner) return 'ScenarioRunner not available';

		const subcmd = args[0];
		if (!subcmd) {
			return 'Usage: /scenario <run|list|run-batch>\nUse /scenario list to see available scenarios';
		}

		return `Scenario command: ${subcmd} (implementation pending)`;
	},
},
{
	name: '/scenario.run',
	aliases: ['.scenario.run'],
	description: 'Run single scenario',
	usage: '/scenario run <id>',
	execute: async (args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		if (!nar.scenarioRunner) return 'ScenarioRunner not available';

		const scenarioId = args[0];
		if (!scenarioId) return 'Usage: /scenario run <id>';

		return `Running scenario: ${scenarioId}\n(Note: Scenario loading pending implementation)`;
	},
},
{
	name: '/scenario.list',
	aliases: ['.scenario.list'],
	description: 'List scenarios filtered by tag',
	usage: '/scenario list [tag]',
	execute: async (args) => {
		const tag = args[0];
		return `Listing scenarios${tag ? ` with tag: ${tag}` : ''}\n(Note: Scenario catalog pending implementation)`;
	},
},
{
	name: '/scenario.run-batch',
	aliases: ['.scenario.run-batch'],
	description: 'Run benchmark suite',
	usage: '/scenario run-batch <suite>',
	execute: async (args) => {
		const suite = args[0];
		if (!suite) return 'Usage: /scenario run-batch <suite>';
		return `Running benchmark suite: ${suite}\n(Note: Batch execution pending implementation)`;
	},
},
{
	name: '/pin',
	aliases: ['.pin'],
	description: 'Store in working memory',
	usage: '/pin <key> <value>',
	execute: async (args, ctx) => {
		const nar = ctx.nar as ExtendedNAR;
		if (!nar.workingMemory) return 'WorkingMemory not available';

		if (args.length < 1) return 'Usage: /pin <key> <value>';

		const key = args[0]!;
		const value = args.slice(1).join(' ') || '';

		nar.workingMemory.pin(key, value);
		return `Pinned ${key} = ${value}`;
	}
},
  {
    name: '/recall',
    aliases: ['.recall'],
    description: 'Recall from working memory',
    usage: '/recall [key]',
    execute: async (args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.workingMemory) return 'WorkingMemory not available';
      
      if (args.length === 0) {
        const all = nar.workingMemory.recallAll();
        if (all.size === 0) return 'Working memory is empty';
        return Array.from(all.entries()).map(([k, v]) => `${k}: ${v}`).join('\n');
      }
      
  const key = args[0]!;
  const value = nar.workingMemory.recall(key);
  return value ? `${key}: ${value}` : `Key ${key} not found in working memory`;
    }
  },
  {
    name: '/unpin',
    aliases: ['.unpin'],
    description: 'Clear working memory',
    usage: '/unpin [key]',
    execute: async (args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.workingMemory) return 'WorkingMemory not available';
      
      if (args.length === 0) {
        nar.workingMemory.unpin();
        return 'Working memory cleared';
      }
      
      const key = args[0];
      nar.workingMemory.unpin(key);
      return `Unpinned ${key}`;
    }
  },
  {
    name: '/evaluate',
    aliases: ['.evaluate'],
    description: 'Evaluate truth value and action tier',
    usage: '/evaluate <frequency> <confidence>',
    execute: async (args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.orchestrationGuide) return 'OrchestrationGuide not available';
      
  if (args.length < 2) return 'Usage: /evaluate <frequency> <confidence>';
  
  const f = parseFloat(args[0]!);
  const c = parseFloat(args[1]!);
      
      if (isNaN(f) || isNaN(c)) return 'Invalid numbers';
      
      const truth = {f, c};
      const tier = nar.orchestrationGuide.evaluate(truth);
      const expectation = nar.orchestrationGuide.expectation(truth);
      const calibrated = nar.orchestrationGuide.calibrateLLMConfidence(truth);
      
      return `Truth: f=${f.toFixed(2)}, c=${c.toFixed(2)}\nTier: ${tier}\nExpectation: ${expectation.toFixed(2)}\nCalibrated (LLM): f=${calibrated.f.toFixed(2)}, c=${calibrated.c.toFixed(2)}`;
    }
  },
  {
    name: '/ground',
    aliases: ['.ground'],
    description: 'Add grounded fact',
    usage: '/ground <fact> <source>',
    execute: async (args, ctx) => {
      const nar = ctx.nar as ExtendedNAR;
      if (!nar.groundingPipeline) return 'GroundingPipeline not available';
      
      if (args.length < 2) return 'Usage: /ground <fact> <source>';
      
      const fact = args.join(' ');
      return `Grounded: ${fact} (Note: Full grounding requires HTTP/Search tools)`;
    }
  },
{
name: '/grounded',
aliases: ['.grounded'],
description: 'List grounded facts',
usage: '/grounded [query]',
execute: async (_args, ctx) => {
const nar = ctx.nar as ExtendedNAR;
if (!nar.groundingPipeline) return 'GroundingPipeline not available';

return 'No grounded facts stored yet';
}
}
];
