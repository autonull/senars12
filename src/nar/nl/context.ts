import type {NAR} from '../nar.js';
import type {TranslationCacheEntry} from './translator.js';

export interface BotContext {
    turn?: {reasoningResult?: {newBeliefs?: Array<{term: string; truth?: {frequency: number; confidence: number}}>}};
    conversation?: {summary?: string; getPinned?(): string[]};
}

export interface ContextOpts {
    attention?: boolean;
    beliefs?: boolean | string[];
    derivations?: boolean;
    goals?: boolean;
    examples?: boolean | TranslationCacheEntry[];
    history?: boolean;
    pinned?: boolean;
    memoryHealth?: boolean;
    focus?: boolean;
    links?: boolean | string[];
    tokenBudget?: number;
}

export class ContextBuilder {
    build(nar: NAR, input: string, ctx?: BotContext, opts: ContextOpts = {}): string {
        const parts: string[] = [];

        if (opts.attention) {
            const attention = this.formatAttention(nar);
            if (attention) parts.push(attention);
        }

        if (opts.beliefs) {
            const terms = Array.isArray(opts.beliefs) ? opts.beliefs : this.extractTerms(input);
            const beliefs = this.formatBeliefs(nar, terms, 15);
            if (beliefs) parts.push(beliefs);
        }

        if (opts.derivations && ctx?.turn?.reasoningResult?.newBeliefs?.length) {
            const derivations = this.formatDerivations(ctx.turn.reasoningResult.newBeliefs.slice(0, 5));
            if (derivations) parts.push(derivations);
        }

        if (opts.goals) {
            const goals = this.formatGoals(nar);
            if (goals) parts.push(goals);
        }

        if (opts.examples) {
            const examples = Array.isArray(opts.examples)
                ? this.formatExamples(opts.examples)
                : '';
            if (examples) parts.push(examples);
        }

        if (opts.history && ctx?.conversation) {
            if (ctx.conversation.summary) parts.push(ctx.conversation.summary);
        }

        if (opts.pinned) {
            const pinned = this.formatPinned(ctx);
            if (pinned) parts.push(pinned);
        }

        if (opts.memoryHealth) {
            const health = this.formatMemoryHealth(nar);
            if (health) parts.push(health);
        }

        if (opts.focus) {
            const focus = this.formatFocus(nar);
            if (focus) parts.push(focus);
        }

        if (opts.links) {
            const terms = Array.isArray(opts.links) ? opts.links : this.extractTerms(input);
            const links = this.formatLinks(nar, terms);
            if (links) parts.push(links);
        }

        return this.truncateToBudget(parts.join('\n'), opts.tokenBudget ?? 2000);
    }

    private formatAttention(nar: NAR): string {
        const report = nar.attentionReport();
        if (report.concepts.length === 0) return '';
        return `Active concepts: ${report.concepts.slice(0, 10).map(c => `${c.term} (${(c.priority * 100).toFixed(0)}%)`).join(', ')}`;
    }

    private formatBeliefs(nar: NAR, terms: string[], max: number): string {
        const allBeliefs = nar.getBeliefs();
        const related = terms
            .flatMap(term => allBeliefs.filter(b => b.term.toString().toLowerCase().includes(term.toLowerCase())))
            .slice(0, max);

        if (related.length === 0) return '';
        return `Related beliefs:\n${related.map(b =>
            `  ${b.term.toString()} :${b.truth ? `${b.truth.f.toFixed(1)}:${b.truth.c.toFixed(1)}` : '0.5:0.8'}`,
        ).join('\n')}`;
    }

    private formatDerivations(newBeliefs: Array<{ term: string; truth?: { frequency: number; confidence: number } }>): string {
        if (newBeliefs.length === 0) return '';
        return `Recent derivations:\n${newBeliefs.map(b =>
            `  ${b.term}${b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : ''}`,
        ).join('\n')}`;
    }

    private formatGoals(nar: NAR): string {
        const goals = nar.getGoals();
        if (goals.length === 0) return '';
        return `Active goals: ${goals.slice(0, 5).map(g => g.term.toString()).join('; ')}`;
    }

    private formatExamples(examples: TranslationCacheEntry[]): string {
        if (examples.length === 0) return '';
        return `Previous translations:\n${examples.map(e =>
            `  "${e.nl}" → ${typeof e.result === 'string' ? e.result : e.result.beliefs.map(b => b.narsese).join('; ')}`,
        ).join('\n')}`;
    }

    private formatPinned(ctx: BotContext | undefined): string {
        const pinned = ctx?.conversation?.getPinned?.() ?? [];
        if (pinned.length === 0) return '';
        return `Pinned context: ${pinned.join('; ')}`;
    }

    private formatMemoryHealth(nar: NAR): string {
        const stats = nar.getStatistics();
        return `Memory: ${stats.totalConcepts} concepts, pressure ${(stats.memoryPressure * 100).toFixed(0)}%`;
    }

    private formatFocus(nar: NAR): string {
        const report = nar.attentionReport();
        if (report.concepts.length === 0) return '';
        return `Focus: ${report.concepts.slice(0, 5).map(c => `${c.term}(${(c.priority * 100).toFixed(0)}%)`).join(', ')}`;
    }

    private formatLinks(nar: NAR, terms: string[]): string {
        const allBeliefs = nar.getBeliefs();
        const links: string[] = [];

        for (const term of terms.slice(0, 3)) {
            const target = allBeliefs.find(b => b.term.toString().toLowerCase().includes(term.toLowerCase()));
            if (target) {
                const concept = nar.getConcept?.(target.term);
                const conceptLinks = concept?.getLinks?.() ?? [];
                if (conceptLinks.length > 0) {
                    links.push(`${term}: ${conceptLinks.slice(0, 3).map(l => `${l.concept.term}(${(l.strength * 100).toFixed(0)}%)`).join(', ')}`);
                }
            }
        }

        return links.length > 0 ? `Links:\n${links.join('\n')}` : '';
    }

    private extractTerms(input: string): string[] {
        const words = input.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
        const stopWords = new Set(['the', 'and', 'are', 'that', 'this', 'what', 'is', 'for', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'all', 'some', 'not', 'but', 'or', 'if', 'then', 'when', 'where', 'why', 'how', 'who', 'which', 'about', 'into', 'through', 'during', 'before', 'after']);
        return [...new Set(words.filter(w => !stopWords.has(w)))].slice(0, 5);
    }

    private truncateToBudget(text: string, budget: number): string {
        if (text.length <= budget) return text;
        const truncated = text.slice(0, budget - 50);
        const lastNewline = truncated.lastIndexOf('\n');
        return lastNewline > budget * 0.8
            ? truncated.slice(0, lastNewline) + '\n[truncated]'
            : truncated + '...[truncated]';
    }
}
