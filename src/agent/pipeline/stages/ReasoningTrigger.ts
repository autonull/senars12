import type {BotContext} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';

interface TriggerDecision {
    activate: boolean;
    confidence: number;
    reason?: string;
    suggestedSteps?: number;
}

class ReasoningTrigger {
    private cooldown = 0;
    private readonly config = {
        heuristicWeight: 0.6,
        lmSignalWeight: 0.4,
        threshold: 0.5,
        cooldownTurns: 3,
        maxStepsPerTrigger: 5,
    };

    shouldTrigger(ctx: BotContext): TriggerDecision {
        if (this.cooldown > 0) { this.cooldown--; return { activate: false, confidence: 0, reason: 'cooldown' }; }
        if (!ctx.capabilities.hasSeNARS) return { activate: false, confidence: 0, reason: 'unavailable' };
        if (ctx.conversation.mode === 'chat') return { activate: false, confidence: 0, reason: 'chat-mode' };

        const heuristicScore = this.evaluateHeuristics(ctx);
        const lmScore = this.evaluateLMSignal(ctx);
        const combined = (heuristicScore * this.config.heuristicWeight) +
                         (lmScore * this.config.lmSignalWeight);

        if (combined >= this.config.threshold) {
            this.cooldown = this.config.cooldownTurns;
            return { activate: true, confidence: combined, reason: this.explain(heuristicScore, lmScore), suggestedSteps: this.suggestSteps(combined) };
        }

        return { activate: false, confidence: combined };
    }

    private evaluateHeuristics(ctx: BotContext): number {
        const input = ctx.turn.input.text.toLowerCase();
        let score = 0;

        if (this.detectKnowledgeGap(input, ctx)) score += 0.3;
        if (this.detectContradiction(input, ctx)) score += 0.4;
        if (/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/.test(input)) score += 0.2;
        if (/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/.test(input)) score += 0.3;
        if (/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i.test(input)) score += 0.2;
        if ((input.match(/\bbecause\b|\btherefore\b|\bthus\b|\bso\b/g) || []).length >= 2) score += 0.2;
        if (/\b(difference between|compare|similar to|unlike|versus|vs)\b/.test(input)) score += 0.2;

        return Math.min(score, 1.0);
    }

    private evaluateLMSignal(ctx: BotContext): number {
        const lastMsg = ctx.conversation.messages.at(-1);
        return lastMsg?.role === 'assistant' && lastMsg.metadata?.suggestsReasoning ? 0.7 : 0;
    }

    private detectKnowledgeGap(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const report = ctx.seNARS.attentionReport();
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some(t => t.length > 3 && !report.concepts.some((c: { term: string }) => c.term.toLowerCase().includes(t)));
    }

    private detectContradiction(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const beliefs = ctx.seNARS.getBeliefs();
        const negations = ['not', "n't", 'no', 'never', 'false', 'wrong'];
        if (!negations.some(n => input.includes(n))) return false;
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some((t: string) => t.length > 3 && beliefs.some((b: { term: { toString(): string } }) => b.term.toString().toLowerCase().includes(t)));
    }

    private explain(heuristic: number, lm: number): string {
        const parts: string[] = [];
        if (heuristic > 0.3) parts.push('heuristic signals');
        if (lm > 0.3) parts.push('LM suggestion');
        return parts.join(' + ') || 'combined score exceeded threshold';
    }

    private suggestSteps(confidence: number): number {
        if (confidence > 0.8) return 10;
        if (confidence > 0.6) return 5;
        return 3;
    }
}

export class ReasoningTriggerStage implements PipelineStage {
    name = 'ReasoningTrigger';
    priority = 5;
    enabled = (ctx: BotContext) => ctx.capabilities.hasSeNARS && ctx.conversation.mode === 'auto';

    constructor(private trigger = new ReasoningTrigger()) {}

    async execute(ctx: BotContext): Promise<void> {
        const decision = this.trigger.shouldTrigger(ctx);
        ctx.turn.reasoningTriggered = decision.activate;
    }
}