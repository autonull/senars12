import type {BotContext, Intent, InputClassification, ClassificationSignal} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import {termParser} from '../../../nar/terms/index.js';

const isNarsese = (text: string): boolean => {
  const t = text.trim();
  if (t.startsWith('/') || t.startsWith('!')) return false;
  try {
    termParser.parse(t);
    return true;
  } catch {
    return false;
  }
};

const DEFAULT_SIGNALS: [RegExp, Intent, number][] = [
  [/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/i, 'reason', 0.5],
  [/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/i, 'reason', 0.4],
  [/\b(difference between|compare|similar to|unlike|versus|vs)\b/i, 'reason', 0.2],
  [/\b(tell me|what is|explain|describe|define)\b/i, 'query', 0.3],
  [/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i, 'reason', 0.2],
];

export class InputClassifier implements PipelineStage {
  name = 'InputClassifier';
  priority = 4;
  enabled = () => true;

  async execute(ctx: BotContext): Promise<void> {
    ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation, ctx.config);
    ctx.events.emit('classify:result', {input: ctx.turn.input.text, classification: ctx.turn.classification});
  }
}

export function classify(input: string, conversation: BotContext['conversation'], config: BotContext['config']): InputClassification {
  const scores: Record<Intent, number> = {chat: 0.1, reason: 0, query: 0, goal: 0, command: 0, narsese: 0};
  const signalList: ClassificationSignal[] = [];
  const t = input.trim();

  if (t.startsWith('/') || t.startsWith('.')) {
    scores.command = 1.0;
    signalList.push({type: 'structure', source: t.startsWith('/') ? 'slash-prefix' : 'dot-prefix', intent: 'command', weight: 1.0});
  }
  if (isNarsese(t)) {
    scores.narsese = 0.9;
    signalList.push({type: 'narsese', source: 'parser-probe', intent: 'narsese', weight: 0.9});
  }
  if (t.startsWith('!')) {
    scores.goal = 0.8;
    signalList.push({type: 'structure', source: 'bang-prefix', intent: 'goal', weight: 0.8});
  }
  if (t.endsWith('?')) {
    scores.query += 0.6;
    signalList.push({type: 'structure', source: 'question-mark', intent: 'query', weight: 0.6});
  }

  const customSignals = config.classifier?.signals;
  if (customSignals) {
    for (const s of customSignals) {
      if (s.pattern.test(t)) {
        scores[s.intent] += s.weight;
        signalList.push({type: s.type as ClassificationSignal['type'], source: s.pattern.source, intent: s.intent, weight: s.weight});
      }
    }
  } else {
    for (const [re, intent, w] of DEFAULT_SIGNALS) {
      if (re.test(t)) {
        scores[intent] += w;
        signalList.push({type: 'keyword', source: re.source, intent, weight: w});
      }
    }
  }

  const lastMsg = conversation.messages.at(-1);
  if (lastMsg?.role === 'assistant' && lastMsg.metadata?.suggestsReasoning) {
    scores.reason += 0.3;
    signalList.push({type: 'lm-suggestion', source: 'prior-turn', intent: 'reason', weight: 0.3});
  }

  const modeW = config.classifier?.modeWeight ?? 0.5;
  if (conversation.mode === 'reason') scores.reason += modeW;
  if (conversation.mode === 'chat') scores.chat += modeW;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [primary, pScore] = sorted[0] as [Intent, number];
  const secondary = (sorted[1]?.[1] ?? 0) > pScore - 0.2 ? sorted[1]![0] as Intent : undefined;
  return {primary, secondary, confidence: Math.min(pScore, 1.0), signals: signalList};
}
