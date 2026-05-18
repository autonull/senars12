import type {BotContext, BotResponse, StreamChunk} from '../BotContext.js';
import type {IOMessage} from '../BotContext.js';

export interface PipelineStage {
    name: string;
    priority: number;
    enabled: (ctx: BotContext) => boolean;
    execute(ctx: BotContext): Promise<void>;
}

export class MessagePipeline {
    private stages: PipelineStage[];

    constructor(stages: PipelineStage[]) {
        this.stages = stages.sort((a, b) => a.priority - b.priority);
    }

    async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
        ctx.turn.input = message;
        for (const stage of this.stages) {
            if (!stage.enabled(ctx)) continue;
            try {
                await stage.execute(ctx);
            } catch (error) {
                ctx.turn.error = error as Error;
                ctx.turn.finalResponse = this.generateErrorResponse(error, ctx);
                break;
            }
            if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') break;
        }
        return this.composeResponse(ctx);
    }

    private composeResponse(ctx: BotContext): BotResponse {
        return {
            text: ctx.turn.finalResponse,
            reasoning: ctx.turn.reasoningResult,
            actions: ctx.turn.actions,
        };
    }

    private generateErrorResponse(error: unknown, ctx: BotContext): string {
        if (error instanceof Error) {
            if (error.message.includes('LM')) {
                return 'LM is currently unavailable. I can still process Narsese input and commands.';
            }
            if (error.message.includes('SeNARS') || error.message.includes('NAR')) {
                return 'Reasoning engine is unavailable. Chat mode is still active.';
            }
            return `An error occurred: ${error.message}`;
        }
        return 'An unknown error occurred';
    }

    getStages(): PipelineStage[] {
        return [...this.stages];
    }
}