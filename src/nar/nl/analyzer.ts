import type {BotContext} from '../../agent/types.js';
import {termParser} from '../terms/index.js';

export type NLIntentType =
    | 'believe' | 'query' | 'goal' | 'forget' | 'focus'
    | 'explain' | 'counterfactual' | 'discover' | 'save' | 'recall';

export interface NLIntent {
    type: NLIntentType;
    payload: Record<string, unknown>;
    priority: number;
    dependsOn?: string[];
}

export interface Ambiguity {
    type: 'parse' | 'intent' | 'term';
    options: string[];
    confidence: number;
}

export interface NLAnalysis {
    intents: NLIntent[];
    concepts: string[];
    ambiguity: Ambiguity[];
    confidence: number;
    isNarsese: boolean;
    isCommand: boolean;
}

const STRUCTURAL_PATTERNS = [
    { re: /^[.!]$/, type: 'command' as const, weight: 0.9 },
    { re: /^\(.*(-->|<->|==>).*[.?]$/, type: 'narsese' as const, weight: 0.95 },
    { re: /^".*"$/, type: 'nl-explicit' as const, weight: 0.8 },
    { re: /\?$/, type: 'query' as const, weight: 0.7 },
    { re: /\.$/, type: 'belief' as const, weight: 0.6 },
];

const KEYWORD_PATTERNS: Array<{ re: RegExp; type: NLIntentType; weight: number }> = [
    { re: /^(remember|know that|learn that|all |some )/i, type: 'believe', weight: 0.8 },
    { re: /^(what|who|where|when|why|how|is |are |does |do |can |could )/i, type: 'query', weight: 0.85 },
    { re: /^(i want|i need|goal:|achieve )/i, type: 'goal', weight: 0.8 },
    { re: /^(forget|remove|delete|clear )/i, type: 'forget', weight: 0.85 },
    { re: /^(focus on|pay attention to|look at )/i, type: 'focus', weight: 0.85 },
    { re: /^(why do|why is|explain|how come)/i, type: 'explain', weight: 0.9 },
    { re: /^(what if|suppose|imagine )/i, type: 'counterfactual', weight: 0.9 },
    { re: /^(find|discover|connect|relate|link )/i, type: 'discover', weight: 0.8 },
    { re: /^(save|store|remember this)/i, type: 'save', weight: 0.8 },
    { re: /^(what were|recall|remind|previous)/i, type: 'recall', weight: 0.85 },
];

export class NLAnalyzer {
    analyze(input: string, _ctx?: BotContext): NLAnalysis {
        const trimmed = input.trim();
        const structural = this.detectStructure(trimmed);
        const keywords = this.detectKeywords(trimmed);
        const narsese = this.detectNarsese(trimmed);

        const intents = this.fuseSignals(structural, keywords, narsese, trimmed);
        const concepts = this.extractConcepts(trimmed);
        const ambiguity = this.detectAmbiguity(intents, trimmed);
        const confidence = this.computeConfidence(intents, ambiguity);

        return {
            intents,
            concepts,
            ambiguity,
            confidence,
            isNarsese: narsese.confidence > 0.8,
            isCommand: structural.type === 'command',
        };
    }

    private detectStructure(input: string): { type: string; confidence: number } {
        for (const p of STRUCTURAL_PATTERNS) {
            if (p.re.test(input)) return { type: p.type, confidence: p.weight };
        }
        return { type: 'nl-implicit', confidence: 0.3 };
    }

    private detectKeywords(input: string): Array<{ type: NLIntentType; confidence: number }> {
        const results: Array<{ type: NLIntentType; confidence: number }> = [];
        for (const p of KEYWORD_PATTERNS) {
            if (p.re.test(input)) results.push({ type: p.type, confidence: p.weight });
        }
        return results;
    }

    private detectNarsese(input: string): { valid: boolean; confidence: number } {
        // Strip trailing punctuation but preserve truth value syntax (:f:c or %f;c%)
        const cleaned = input.replace(/(?::\s*[0-9.]+\s*:\s*[0-9.]+|%s*[0-9.]+\s*;\s*[0-9.]+%)\s*$/, '').replace(/[.!?]+\s*$/, '').trim();
        if (!/^[\(\[<]/.test(cleaned)) return { valid: false, confidence: 0 };
        try {
            termParser.parseWithTruth(input);
            return { valid: true, confidence: 0.95 };
        } catch {
            return { valid: false, confidence: 0.2 };
        }
    }

    private fuseSignals(
        structural: { type: string; confidence: number },
        keywords: Array<{ type: NLIntentType; confidence: number }>,
        narsese: { valid: boolean; confidence: number },
        _input: string,
    ): NLIntent[] {
        if (narsese.valid && narsese.confidence > 0.8) {
            const isQuestion = _input.trim().endsWith('?');
            return [{
                type: isQuestion ? 'query' : 'believe',
                payload: { narsese: _input.trim() },
                priority: 1,
            }];
        }

        if (structural.type === 'command') {
            return [{ type: 'believe', payload: { raw: _input }, priority: 1 }];
        }

        const intents: NLIntent[] = [];
        const seen = new Set<string>();

        for (const kw of keywords) {
            if (!seen.has(kw.type)) {
                seen.add(kw.type);
                intents.push({ type: kw.type, payload: { raw: _input }, priority: intents.length + 1 });
            }
        }

        if (intents.length === 0) {
            const isQuestion = _input.trim().endsWith('?');
            intents.push({
                type: isQuestion ? 'query' : 'believe',
                payload: { raw: _input },
                priority: 1,
            });
        }

        return intents;
    }

    private extractConcepts(input: string): string[] {
        const cleaned = input.replace(/[.!?]$/, '').trim();
        const terms = new Set<string>();

        const narseseMatch = cleaned.match(/\(([^)]+)\)/);
        if (narseseMatch) {
            const atoms = narseseMatch[1]!.match(/[A-Za-z_][A-Za-z0-9_]*/g);
            atoms?.forEach(a => terms.add(a));
        }

        const nlTerms = cleaned.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*\b/g);
        nlTerms?.forEach(t => terms.add(t.toLowerCase()));

        const singleWords = cleaned.match(/\b[A-Za-z]{3,}\b/g);
        singleWords?.forEach(w => {
            const lower = w.toLowerCase();
            if (!['the', 'and', 'are', 'that', 'this', 'what', 'is', 'a', 'an', 'to', 'for', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'all', 'some', 'not', 'but', 'or', 'if', 'then', 'when', 'where', 'why', 'how', 'who', 'which'].includes(lower)) {
                terms.add(lower);
            }
        });

        return [...terms].slice(0, 20);
    }

    private detectAmbiguity(intents: NLIntent[], input: string): Ambiguity[] {
        const ambiguities: Ambiguity[] = [];

        if (intents.length > 1) {
            ambiguities.push({
                type: 'intent',
                options: intents.map(i => i.type),
                confidence: 0.5,
            });
        }

        const hasMultipleParses = this.checkMultipleNarseseParses(input);
        if (hasMultipleParses) {
            ambiguities.push({
                type: 'parse',
                options: ['universal', 'existential', 'property'],
                confidence: 0.4,
            });
        }

        return ambiguities;
    }

    private checkMultipleNarseseParses(_input: string): boolean {
        const lower = _input.toLowerCase().trim();
        const patterns = [
            /^(\S+)\s+(?:are|is)\s+(\S+)/i,
            /^all\s+(\S+)\s+(?:are|is)\s+(\S+)/i,
            /^some\s+(\S+)\s+(?:are|is)\s+(\S+)/i,
        ];
        let matches = 0;
        for (const p of patterns) {
            if (p.test(lower)) matches++;
        }
        return matches >= 2;
    }

    private computeConfidence(intents: NLIntent[], ambiguity: Ambiguity[]): number {
        if (intents.length === 0) return 0.1;
        const intentConfidence = Math.max(...intents.map(() => 0.7));
        const ambiguityPenalty = ambiguity.reduce((sum, a) => sum + a.confidence * 0.2, 0);
        return Math.max(0.1, Math.min(1.0, intentConfidence - ambiguityPenalty));
    }
}
