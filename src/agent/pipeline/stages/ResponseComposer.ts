import type {BotContext, DirectiveResult} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {TaskFormatter} from '../../../nar/utils/task-formatter.js';
import {OrchestrationGuide} from '../../../nar/orchestration.js';

export class ResponseComposer implements PipelineStage {
  name = 'ResponseComposer';
  priority = 9;
  enabled = () => true;

  private orchestrationGuide = new OrchestrationGuide();

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

    if (ctx.turn.lmResponse) {
      // Enforce action thresholds on LM response
      const tieredResponse = this.enforceThresholds(ctx);
      parts.push(tieredResponse);
    }
    
    if (ctx.turn.directiveResults.length) {
      const s = this.formatDirectives(ctx.turn.directiveResults);
      if (s) parts.push(s);
    }
    if (ctx.turn.toolResults.length) parts.push(this.formatToolResults(ctx.turn.toolResults));
    if (!parts.length) parts.push(this.fallback(ctx));

    // Add proof trail if available
    const proofTrail = this.formatProofTrail(ctx);
    if (proofTrail) {
      parts.push('\n## Proof Trail', proofTrail);
    }

    ctx.turn.finalResponse = parts.join('\n\n');
  }

  private enforceThresholds(ctx: BotContext): string {
    const response = ctx.turn.lmResponse || '';
    // Check if response contains confidence indicators
    const confidenceMatch = response.match(/:\s*(\d+\.?\d*)\s*:\s*(\d+\.?\d*)/);
    if (confidenceMatch) {
      const f = parseFloat(confidenceMatch[1]!);
      const c = parseFloat(confidenceMatch[2]!);
      const tier = this.orchestrationGuide.evaluate({f, c});
      
      if (tier === 'IGNORE') {
        return 'Insufficient evidence for this conclusion.';
      } else if (tier === 'HYPOTHESIZE') {
        return `Hypothesis (confidence below action threshold): ${response}`;
      }
    }
    return response;
  }

  private formatProofTrail(ctx: BotContext): string | null {
    try {
      const trace = ctx.turn.reasoningResult?.trace;
      if (!trace || !trace.length) return null;
      
      const lines = trace.slice(0, 5).map((step: any) => {
        const rule = step.rule || 'unknown';
        const premises = step.premises?.map((p: any) => p.toString()).join(', ') || '';
        const conclusion = step.conclusion?.toString() || '';
        return `  ${rule}: ${premises} → ${conclusion}`;
      });
      
      return lines.join('\n');
    } catch {
      return null;
    }
  }

  private formatReasoningResult(result: {steps: number; newBeliefs: {term: string; truth?: {frequency: number; confidence: number}}[]}, showSteps: boolean): string {
    if (!showSteps || !result.newBeliefs.length) return `Derived ${result.steps} belief(s).`;
    const lines = [`Derived ${result.steps} belief(s):`];
    for (const b of result.newBeliefs.slice(0, 5)) {
      const tv = b.truth ? ` :${TaskFormatter.formatTruth({f: b.truth.frequency, c: b.truth.confidence}, {precision: 2})}` : '';
      lines.push(` → ${b.term}${tv}`);
    }
    if (result.newBeliefs.length > 5) lines.push(` ... and ${result.newBeliefs.length - 5} more`);
    return lines.join('\n');
  }

  private formatDirectives(results: DirectiveResult[]): string {
    const lines: string[] = [];
    for (const r of results) {
      if (!r.success) { lines.push(` ✗ ${r.directive.type}: ${r.error}`); continue; }
      if (r.directive.type === 'believe') lines.push(` ✓ Added: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
      else if (r.directive.type === 'question') lines.push(` ✓ Queried: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
      else if (r.directive.type === 'tool_call') lines.push(` ✓ Tool ${r.directive.name}: ${String(r.result).slice(0, 80)}`);
    }
    return lines.length ? lines.join('\n') : '';
  }

  private formatToolResults(results: {name: string; result?: unknown; error?: string}[]): string {
    return results.map(r => r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name}: ${String(r.result)}`).join('\n');
  }

  private fallback(ctx: BotContext): string {
    const c = ctx.turn.classification.primary;
    if (c === 'narsese') return 'Processed. No derivations.';
    if (c === 'query') return ctx.capabilities.hasSeNARS ? 'No derivation found. Try adding related beliefs first.' : "I don't have enough information to answer that.";
    return ctx.capabilities.hasLM ? "I'm not sure how to respond to that." : 'Processed.';
  }
}
