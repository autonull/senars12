import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';

export class ResponseComposer implements PipelineStage {
    name = 'ResponseComposer';
    priority = 9;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        if (ctx.turn.finalResponse) return;

        const parts: string[] = [];

        if (ctx.turn.reasoningResult) {
            const r = ctx.turn.reasoningResult;
            if (r.steps > 0) {
                parts.push(this.formatReasoningResult(r));
            } else if (ctx.turn.classification.primary === 'narsese') {
                parts.push('No derivations found.');
            }
        }

        if (ctx.turn.lmResponse) {
            parts.push(ctx.turn.lmResponse);
        }

        if (ctx.turn.toolResults.length > 0) {
            parts.push(this.formatToolResults(ctx.turn.toolResults));
        }

        if (parts.length === 0) {
            const classification = ctx.turn.classification;
            switch (classification.primary) {
                case 'narsese':
                    parts.push('Processed. No derivations.');
                    break;
                case 'query':
                    parts.push(ctx.capabilities.hasSeNARS
                        ? 'No derivation found. Try adding related beliefs first.'
                        : "I don't have enough information to answer that.");
                    break;
                default:
                    parts.push(ctx.capabilities.hasLM
                        ? "I'm not sure how to respond to that."
                        : 'Processed.');
            }
        }

        ctx.turn.finalResponse = parts.join('\n\n');
    }

    private formatReasoningResult(result: { steps: number; beliefs: { term: string; truth?: { frequency: number; confidence: number } }[] }): string {
        return `Derived ${result.steps} belief(s).`;
    }

    private formatToolResults(results: { name: string; result?: unknown; error?: string }[]): string {
        return results.map(r =>
            r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name}: ${String(r.result)}`
        ).join('\n');
    }
}