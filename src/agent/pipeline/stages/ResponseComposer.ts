import type {BotContext, DirectiveResult} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {TaskFormatter} from '../../../nar/utils/task-formatter.js';

export class ResponseComposer implements PipelineStage {
    name = 'ResponseComposer';
    priority = 9;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        if (ctx.turn.finalResponse) return;

        const parts: string[] = [];

        if (ctx.turn.queryAnswer) {
            parts.push(`Answer: ${ctx.turn.queryAnswer}`);
        } else if (ctx.turn.reasoningResult) {
            const r = ctx.turn.reasoningResult;
            if (r.steps > 0) {
                parts.push(this.formatReasoningResult(r, ctx.config.streaming.showReasoningSteps));
            } else if (ctx.turn.classification.primary === 'narsese') {
                parts.push('No derivations found.');
            }
        }

        if (ctx.turn.lmResponse) parts.push(ctx.turn.lmResponse);
        if (ctx.turn.directiveResults.length) {
            const s = this.formatDirectives(ctx.turn.directiveResults);
            if (s) parts.push(s);
        }
        if (ctx.turn.toolResults.length) parts.push(this.formatToolResults(ctx.turn.toolResults));
        if (!parts.length) parts.push(this.fallback(ctx));

        ctx.turn.finalResponse = parts.join('\n\n');
    }

    private formatReasoningResult(result: {steps: number; newBeliefs: {term: string; truth?: {frequency: number; confidence: number}}[]}, showSteps: boolean): string {
        if (!showSteps || !result.newBeliefs.length) return `Derived ${result.steps} belief(s).`;
        const lines = [`Derived ${result.steps} belief(s):`];
        for (const b of result.newBeliefs.slice(0, 5)) {
            const tv = b.truth ? ` :${TaskFormatter.formatTruth({f: b.truth.frequency, c: b.truth.confidence}, {precision: 2})}` : '';
            lines.push(`  \u2192 ${b.term}${tv}`);
        }
        if (result.newBeliefs.length > 5) lines.push(`  ... and ${result.newBeliefs.length - 5} more`);
        return lines.join('\n');
    }

    private formatDirectives(results: DirectiveResult[]): string {
        const lines: string[] = [];
        for (const r of results) {
            if (!r.success) { lines.push(`  \u2717 ${r.directive.type}: ${r.error}`); continue; }
            if (r.directive.type === 'believe') lines.push(`  \u2713 Added: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            else if (r.directive.type === 'question') lines.push(`  \u2713 Queried: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            else if (r.directive.type === 'tool_call') lines.push(`  \u2713 Tool ${r.directive.name}: ${String(r.result).slice(0, 80)}`);
        }
        return lines.length ? lines.join('\n') : '';
    }

    private formatToolResults(results: {name: string; result?: unknown; error?: string}[]): string {
        return results.map(r => r.error ? `\u2717 ${r.name}: ${r.error}` : `\u2713 ${r.name}: ${String(r.result)}`).join('\n');
    }

    private fallback(ctx: BotContext): string {
        const c = ctx.turn.classification.primary;
        if (c === 'narsese') return 'Processed. No derivations.';
        if (c === 'query') return ctx.capabilities.hasSeNARS ? 'No derivation found. Try adding related beliefs first.' : "I don't have enough information to answer that.";
        return ctx.capabilities.hasLM ? "I'm not sure how to respond to that." : 'Processed.';
    }
}
