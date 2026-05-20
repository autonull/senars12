import type {BotContext, Intent, InputClassification, ClassificationSignal} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {NLAnalyzer, type NLAnalysis, type NLIntent} from '../../../nar/nl/analyzer.js';

export class NLAnalyzerStage implements PipelineStage {
  name = 'NLAnalyzer';
  priority = 4;
  enabled = () => true;

  private analyzer = new NLAnalyzer();

  async execute(ctx: BotContext): Promise<void> {
    const input = ctx.turn.input.text.trim();
    const analysis = this.analyzer.analyze(input, ctx);

    // Convert NLAnalysis to InputClassification for backward compatibility
    ctx.turn.classification = this.toClassification(analysis, ctx);

    // Store full analysis for downstream stages
    (ctx.turn as any).nlAnalysis = analysis;

    ctx.events.emit('nl:analyzed', { input, analysis });

    // Emit clarification event if needed
    if (analysis.ambiguity.length > 0 && analysis.confidence < 0.5) {
      ctx.events.emit('nl:clarification-needed', { ambiguity: analysis.ambiguity[0]! });
    }
  }

  private toClassification(analysis: NLAnalysis, ctx: BotContext): InputClassification {
    const primaryIntent = this.mapPrimaryIntent(analysis);
    const signals: ClassificationSignal[] = this.buildSignals(analysis);

    return {
      primary: primaryIntent,
      secondary: analysis.intents.length > 1 ? this.mapIntent(analysis.intents[1]!.type) : undefined,
      confidence: analysis.confidence,
      signals,
      narseseTerms: analysis.isNarsese ? [ctx.turn.input.text.trim()] : undefined,
    };
  }

  private mapPrimaryIntent(analysis: NLAnalysis): Intent {
    if (analysis.isCommand) return 'command';
    if (analysis.isNarsese) {
      return analysis.intents[0]?.type === 'query' ? 'query' : 'narsese';
    }

    const primary = analysis.intents[0];
    if (!primary) return 'chat';

    return this.mapIntent(primary.type);
  }

  private mapIntent(type: NLIntent['type']): Intent {
    switch (type) {
      case 'believe': return 'narsese';
      case 'query': return 'query';
      case 'goal': return 'goal';
      case 'explain': return 'reason';
      case 'counterfactual': return 'reason';
      case 'discover': return 'reason';
      case 'forget':
      case 'focus':
      case 'save':
      case 'recall': return 'command';
      default: return 'chat';
    }
  }

  private buildSignals(analysis: NLAnalysis): ClassificationSignal[] {
    const signals: ClassificationSignal[] = [];

    if (analysis.isNarsese) {
      signals.push({ type: 'narsese', source: 'parser-probe', intent: 'narsese', weight: 0.95 });
    }

    if (analysis.isCommand) {
      signals.push({ type: 'structure', source: 'command-pattern', intent: 'command', weight: 0.9 });
    }

    for (const intent of analysis.intents) {
      signals.push({
        type: 'keyword',
        source: `nl-analyzer:${intent.type}`,
        intent: this.mapIntent(intent.type),
        weight: 0.7,
      });
    }

    if (analysis.ambiguity.length > 0) {
      signals.push({
        type: 'pattern',
        source: 'ambiguity-detected',
        intent: 'query',
        weight: analysis.ambiguity[0]!.confidence,
      });
    }

    return signals;
  }
}
