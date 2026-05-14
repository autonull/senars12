import type {CommandContext, CommandDefinition} from './index.js';
import {box} from '../display.js';

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
        name: '.ask-nl',
        description: 'Ask natural language question',
        usage: '.ask-nl <natural language question>',
        handler: async (ctx, args) => {
            const question = args.join(' ');
            if (!question) {
                ctx.logger.info('Usage: .ask-nl <natural language question>');
                ctx.logger.info('Example: .ask-nl Is a bird an animal?');
                return;
            }

            try {
                ctx.logger.info(`Asking: "${question}"`);
                const askNL = (ctx.nar as any).askNaturalLanguage?.(question);
                if (askNL) {
                    const answer = await askNL;
                    ctx.logger.info(`\n→ ${answer}`);
                } else {
                    ctx.logger.info('Natural language query not available');
                }
            } catch (error) {
                ctx.logger.error(`Error: ${error}`);
            }
        }
    }
];