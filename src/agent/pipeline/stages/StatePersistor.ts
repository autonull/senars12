import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {EpisodicMemory} from '../../../nar/memory/EpisodicMemory.js';

export class StatePersistor implements PipelineStage {
    name = 'StatePersistor';
    priority = 11;
    enabled = () => true;

    constructor(private episodicMemory?: EpisodicMemory) {}

    async execute(ctx: BotContext): Promise<void> {
        if (this.episodicMemory) {
            this.episodicMemory.log('input', ctx.turn.input.text, {
                classification: ctx.turn.classification.primary,
                reasoningTriggered: ctx.turn.reasoningTriggered,
                sender: ctx.connection.sender,
                source: ctx.connection.id,
                output: ctx.turn.finalResponse,
            });
        }
    }
}