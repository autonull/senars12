import type {BotContext, Intent, InputClassification, ClassificationSignal} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';

const NARSESE_REGEX = /^\s*\(\s*<[^>]+>\s*(-->|<->|==>|<=>|&&|\|\|)\s*/;

const KEYWORD_SIGNALS: [RegExp, Intent, number][] = [
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
        ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation);
    }
}

export function classify(input: string, conversation: BotContext['conversation']): InputClassification {
    const scores: Record<Intent, number> = { chat: 0.1, reason: 0, query: 0, goal: 0, command: 0, narsese: 0 };
    const signals: ClassificationSignal[] = [];
    const trimmed = input.trim();

    if (trimmed.startsWith('/') || trimmed.startsWith('.')) {
        scores.command = 1.0;
        signals.push({ type: 'structure', source: trimmed.startsWith('/') ? 'slash-prefix' : 'dot-prefix', intent: 'command', weight: 1.0 });
    }

    if (NARSESE_REGEX.test(trimmed)) {
        scores.narsese = 0.9;
        signals.push({ type: 'narsese', source: 'syntax-match', intent: 'narsese', weight: 0.9 });
    }

    if (trimmed.startsWith('!')) {
        scores.goal = 0.8;
        signals.push({ type: 'structure', source: 'bang-prefix', intent: 'goal', weight: 0.8 });
    }

    if (trimmed.endsWith('?')) {
        scores.query += 0.6;
        signals.push({ type: 'structure', source: 'question-mark', intent: 'query', weight: 0.6 });
    }

    for (const [pattern, intent, weight] of KEYWORD_SIGNALS) {
        if (pattern.test(trimmed)) {
            scores[intent] += weight;
            signals.push({ type: 'keyword', source: pattern.source, intent, weight });
        }
    }

    const lastMsg = conversation.messages.at(-1);
    if (lastMsg?.role === 'assistant' && lastMsg.metadata?.suggestsReasoning) {
        scores.reason += 0.3;
        signals.push({ type: 'lm-suggestion', source: 'prior-turn', intent: 'reason', weight: 0.3 });
    }

    if (conversation.mode === 'reason') scores.reason += 0.5;
    if (conversation.mode === 'chat') scores.chat += 0.5;

    const primary = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a) as [Intent, number];
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const secondaryScore = sorted[1]?.[1] ?? 0;
    const secondary = secondaryScore > primary[1] - 0.2 ? sorted[1]?.[0] as Intent : undefined;

    return { primary: primary[0], secondary, confidence: Math.min(primary[1], 1.0), signals };
}