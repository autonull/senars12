import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';

export class InputNormalizer implements PipelineStage {
    name = 'InputNormalizer';
    priority = 1;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        ctx.turn.input.text = text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
    }
}