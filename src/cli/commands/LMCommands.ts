import type {CommandDefinition} from './index.js';
import {box} from '../display.js';
import {
	getTurnkeyConfig,
	createLMClientFromConfig,
	type ProviderType
} from '../../nar/lm/defaults.js';

export const LMCommands: CommandDefinition[] = [
	{
		name: '.lm-status',
		description: 'Show language model status',
		usage: '.lm-status',
		handler: (ctx) => {
			const lm = ctx.getLM();
			if (!lm) {
				ctx.logger.info('LM client not configured');
				return;
			}

			ctx.logger.info('\n' + box('LM Status', [
				`Provider: ${String(lm.provider ?? 'unknown')}`,
				`Model: ${String(lm.model ?? 'unknown')}`,
				`Available: ${lm.available ? 'Yes' : 'No'}`
			]) + '\n');
		}
	},
	{
		name: '.lm-config',
		description: 'Show turnkey LM configuration',
		usage: '.lm-config',
		handler: (ctx) => {
			const config = getTurnkeyConfig();
			ctx.logger.info('\n' + box('Turnkey LM Configuration', [
				`Provider: ${config.lm.provider}`,
				`Model: ${config.lm.model}`,
				`Device: ${config.lm.device}`,
				`Quantized: ${config.lm.quantized}`,
				`Temperature: ${config.lm.temperature}`,
				`Max Tokens: ${config.lm.maxTokens}`,
				`Fallback Chain: ${config.fallbackChain.join(' → ')}`
			]) + '\n');
		}
	},
	{
		name: '.lm-switch',
		description: 'Switch language model',
		usage: '.lm-switch <model-name>',
		handler: (ctx, args) => {
			const model = args[0];
			if (!model) {
				ctx.logger.info('Usage: .lm-switch <model-name>');
				return;
			}

			const lm = ctx.getLM();
			if (!lm) {
				ctx.logger.info('LM client not configured');
				return;
			}

			if (lm.setModel) {
				lm.setModel(model);
				ctx.logger.info(`✓ Switched to model: ${model}`);
			} else {
				ctx.logger.info('Model switching not supported by this LM client');
			}
		}
	},
	{
	name: '.lm-switch-provider',
	description: 'Switch LM provider (transformers/ollama/mock)',
	usage: '.lm-switch-provider <provider>',
	handler: (ctx, args) => {
		const provider = args[0] as ProviderType;
		if (!provider || !['transformers', 'ollama', 'mock'].includes(provider)) {
			ctx.logger.info('Usage: .lm-switch-provider <transformers|ollama|mock>');
			ctx.logger.info('Current provider priority: transformers(1) → ollama(2) → mock(99)');
			return;
		}

		try {
			createLMClientFromConfig(provider);
			ctx.logger.info(`✓ Switched to provider: ${provider}`);
		} catch (error) {
			ctx.logger.error(`Failed to switch provider: ${error}`);
		}
	}
	},
	{
		name: '.ask-nl',
		description: 'Ask natural language question',
		usage: '.ask-nl <natural language question>',
		handler: async (ctx, args) => {
			const question = args.join(' ');
			if (!question) {
				ctx.logger.info('Usage: .ask-nl <natural language question>');
				ctx.logger.info('Example: .ask-nl what is 2+2?');
				return;
			}

			const lm = ctx.getLM();
			if (!lm) {
				ctx.logger.info('LM client not configured');
				return;
			}

			try {
				ctx.logger.info(`Asking: "${question}"`);
				
				// Initialize LM if needed
				if ('initialize' in lm && typeof lm.initialize === 'function') {
					await lm.initialize();
				}
				
				// Ask LM directly for a concise answer
				const prompt = `Q: ${question} A:`;
				const response = await lm.generateText(prompt);
				ctx.logger.info(`→ ${response || '(no response)'}`);
				
			} catch (error) {
				ctx.logger.error(`Error: ${error}`);
			}
		}
	}
];