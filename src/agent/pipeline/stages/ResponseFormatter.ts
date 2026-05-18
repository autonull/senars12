import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';

export class ResponseFormatter implements PipelineStage {
    name = 'ResponseFormatter';
    priority = 10;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const {type} = ctx.connection;
        const text = ctx.turn.finalResponse;

        if (type === 'irc') {
            ctx.turn.finalResponse = this.formatForIRC(text);
        }
    }

    private formatForIRC(text: string): string {
        return text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .slice(0, 400);
    }
}