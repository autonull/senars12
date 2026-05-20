import type {LanguageModel} from 'ai';
import {generateObject, generateText} from 'ai';
import type {SeNARSRegistry} from '../lm/providers.js';
import {getStructuredModel} from '../lm/providers.js';
import {type TranslationResult, TranslationSchema} from './schemas.js';
import {termParser} from '../terms/index.js';

interface NLParserDef {
    name: string;
    match: (input: string) => boolean;
    translate: (input: string) => string | null;
}

const TERM_RE = String.raw`(?:[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*)`;
const TERM_CAP_RE = String.raw`(?:[A-Z][A-Za-z_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*)`;
const normalizeTerm = (t: string | undefined): string => (t ?? '').trim().replace(/\s+/g, '_');

const NL_PATTERNS: NLParserDef[] = [
    {
        name: 'universal',
        match: t => new RegExp(`^all\\s+${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^all\\s+(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>. :1.0:0.9)` : null;
        },
    },
    {
        name: 'existential',
        match: t => new RegExp(`^some\\s+${TERM_RE}\\s+are\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^some\\s+(${TERM_RE})\\s+are\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>. :0.5:0.5)` : null;
        },
    },
    {
        name: 'is-a',
        match: t => new RegExp(`^${TERM_CAP_RE}\\s+is\\s+a\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_CAP_RE})\\s+is\\s+a\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>.)` : null;
        },
    },
    {
        name: 'is',
        match: t => new RegExp(`^${TERM_RE}\\s+is\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+is\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} --> [${normalizeTerm(m[2])}]>. :0.9:0.9)` : null;
        },
    },
    {
        name: 'similarity',
        match: t => new RegExp(`^${TERM_RE}\\s+(?:is\\s+)?like\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+(?:is\\s+)?like\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} <-> ${normalizeTerm(m[2])}>. :0.8:0.8)` : null;
        },
    },
    {
        name: 'causal',
        match: t => new RegExp(`^${TERM_RE}\\s+causes\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+causes\\s+(${TERM_RE})`, 'i'));
            return m ? `((<${normalizeTerm(m[1])}> =/> <${normalizeTerm(m[2])}>). :0.8:0.8)` : null;
        },
    },
    {
        name: 'implication',
        match: t => /^if\s+.+?\s+then\s+.+/i.test(t),
        translate: t => {
            const m = t.match(/^if\s+(.+?)\s+then\s+(.+)/i);
            return m ? `((<${normalizeTerm(m[1])}> ==> <${normalizeTerm(m[2])}>). :0.9:0.9)` : null;
        },
    },
    {
        name: 'negation',
        match: t => new RegExp(`^${TERM_RE}\\s+is\\s+not\\s+(?:a\\s*)?${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+is\\s+not\\s+(?:a\\s*)?(${TERM_RE})`, 'i'));
            return m ? `(--(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>). :0.9:0.9)` : null;
        },
    },
    {
        name: 'query-what',
        match: t => /^what\s+is\s+/i.test(t),
        translate: t => {
            const m = t.match(/^what\s+is\s+(.+)/i);
            return m ? `(<${normalizeTerm(m[1])} --> ?1>?)` : null;
        },
    },
    {
        name: 'query-whether',
        match: t => /^is\s+(.+?)\s+(?:a\s+)?(.+?)\??$/i.test(t),
        translate: t => {
            const m = t.match(/^is\s+(.+?)\s+(?:a\s+)?(.+?)\??$/i);
            return m ? `(<${normalizeTerm(m[1])} --> ${normalizeTerm(m[2])}>?)` : null;
        },
    },
    {
        name: 'goal',
        match: t => /^i\s+(?:want|need)\s+to\s+/i.test(t),
        translate: t => {
            const m = t.match(/^i\s+(?:want|need)\s+to\s+(.+)/i);
            return m ? `(<${normalizeTerm(m[1])} --> ?1>!)` : null;
        },
    },
    {
        name: 'has',
        match: t => new RegExp(`^${TERM_RE}\\s+has\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+has\\s+(${TERM_RE})`, 'i'));
            return m ? `(<${normalizeTerm(m[1])} --> [has_${normalizeTerm(m[2])}]>. :0.9:0.9)` : null;
        },
    },
    {
        name: 'implies',
        match: t => new RegExp(`^${TERM_RE}\\s+(?:implies|means|leads to)\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+(?:implies|means|leads to)\\s+(${TERM_RE})`, 'i'));
            return m ? `((<${normalizeTerm(m[1])}> ==> <${normalizeTerm(m[2])}>).)` : null;
        },
    },
    {
        name: 'temporal-before',
        match: t => new RegExp(`^${TERM_RE}\\s+before\\s+${TERM_RE}`, 'i').test(t),
        translate: t => {
            const m = t.match(new RegExp(`^(${TERM_RE})\\s+before\\s+(${TERM_RE})`, 'i'));
            return m ? `((<${normalizeTerm(m[1])}> ,/ <${normalizeTerm(m[2])}>). :0.9:0.9)` : null;
        },
    },
];

export interface TranslationCacheEntry {
    nl: string;
    result: TranslationResult | string;
    timestamp: number;
}

export class TranslationCache {
    private cache = new Map<string, TranslationCacheEntry>();
    private maxSize = 500;

    record(nl: string, result: TranslationResult | string): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(nl.toLowerCase(), { nl, result, timestamp: Date.now() });
    }

    get(nl: string): TranslationResult | string | null {
        return this.cache.get(nl.toLowerCase())?.result ?? null;
    }

    getRelevant(nl: string, max = 3): TranslationCacheEntry[] {
        const words = new Set(nl.toLowerCase().split(/\s+/));
        return [...this.cache.values()]
            .filter(e => e.nl.toLowerCase().split(/\s+/).some(w => words.has(w)))
            .slice(0, max);
    }
}

export class NLTranslator {
    private registry: SeNARSRegistry;
    private cache = new TranslationCache();
    private parsers: NLParserDef[] = NL_PATTERNS;

    constructor(registry: SeNARSRegistry) {
        this.registry = registry;
    }

    setParsers(parsers: NLParserDef[]): void {
        this.parsers = parsers;
    }

    async translate(
        nl: string,
        ctx?: { input?: string; beliefs?: string[] },
        maxRetries = 2,
    ): Promise<TranslationResult | string | null> {
        const cached = this.cache.get(nl);
        if (cached) return cached;

        let lastError: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.tryTiers(nl, ctx, lastError);
                if (result) {
                    this.cache.record(nl, result);
                    return result;
                }
                lastError = 'No valid output produced';
            } catch (e) {
                lastError = e instanceof Error ? e.message : String(e);
            }
        }

        return null;
    }

    private async tryTiers(
        nl: string,
        ctx?: { input?: string; beliefs?: string[] },
        lastError?: string | null,
    ): Promise<TranslationResult | string | null> {
        const tier1 = this.tryTier1(nl);
        if (tier1) return tier1;

        const tier2 = await this.tryTier2(nl, ctx, lastError);
        if (tier2) return tier2;

        return await this.tryTier3(nl, lastError);
    }

    private tryTier1(nl: string): TranslationResult | null {
        for (const parser of this.parsers) {
            if (parser.match(nl)) {
                const narsese = parser.translate(nl);
                if (narsese && this.validateNarsese(narsese)) {
                    return {
                        beliefs: [{ narsese, truth: this.extractTruth(narsese) }],
                        isQuestion: nl.trim().endsWith('?'),
                        summary: nl,
                    };
                }
            }
        }
        return null;
    }

    private async tryTier2(
        nl: string,
        ctx?: { input?: string; beliefs?: string[] },
        lastError?: string | null,
    ): Promise<TranslationResult | null> {
        const model = getStructuredModel(this.registry);
        if (!model) return null;

        const prompt = this.buildTranslationPrompt(nl, ctx, lastError);

        try {
            const { object } = await generateObject({
                model,
                prompt,
                schema: TranslationSchema,
            });

            const validBeliefs = object.beliefs.filter(b => this.validateNarsese(b.narsese));
            if (validBeliefs.length === 0) return null;

            return { ...object, beliefs: validBeliefs };
        } catch {
            return null;
        }
    }

    private async tryTier3(nl: string, lastError?: string | null): Promise<string | null> {
        const model = this.registry?.languageModel('cloud:fast')
            ?? this.registry?.languageModel('local:fast')
            ?? this.registry?.languageModel('builtin:compact');
        if (!model) return null;

        const errorContext = lastError ? ` Previous error: ${lastError}.` : '';
        const prompt = `Convert this natural language to Narsese format. Output only valid Narsese, nothing else.${errorContext}\n\nInput: "${nl}"`;

        try {
            const result = await generateText({ model, prompt });
            const cleaned = result.text.trim().replace(/^`+|`+$/g, '').trim();
            return this.validateNarsese(cleaned) ? cleaned : null;
        } catch {
            return null;
        }
    }

    private buildTranslationPrompt(
        nl: string,
        ctx?: { input?: string; beliefs?: string[] },
        lastError?: string | null,
    ): string {
        const parts: string[] = [];

        parts.push('You translate natural language to Narsese logic.');
        parts.push('Narsese syntax:');
        parts.push('  (A --> B) inheritance, (A <-> B) similarity, (A ==> B) implication');
        parts.push('  (A =/> B) temporal, [property], --(negation), (A --> ?1) question');
        parts.push('Rules:');
        parts.push('  - Universal ("all") → frequency 1.0, confidence 0.9');
        parts.push('  - Typical statements → frequency 0.9, confidence 0.9');
        parts.push('  - Existential ("some") → frequency 0.5, confidence 0.5');
        parts.push('  - Cap confidence < 1.0 unless explicitly "all"');

        if (ctx?.beliefs?.length) {
            parts.push('\nRelated beliefs:');
            ctx.beliefs.slice(0, 10).forEach(b => parts.push(`  ${b}`));
        }

        if (lastError) {
            parts.push(`\nPrevious attempt failed: ${lastError}. Try a different approach.`);
        }

        parts.push(`\nTranslate: "${nl}"`);

        return parts.join('\n');
    }

    private validateNarsese(text: string): boolean {
        if (!text) return false;
        const cleaned = text.replace(/^`+|`+$/g, '').trim();
        if (!cleaned) return false;
        try {
            termParser.parse(cleaned);
            return true;
        } catch {
            return false;
        }
    }

    private extractTruth(narsese: string): { f: number; c: number } | undefined {
        const truthMatch = narsese.match(/:\s*([\d.]+)\s*:\s*([\d.]+)\s*\)/);
        if (truthMatch) {
            return {
                f: parseFloat(truthMatch[1] ?? '0.9'),
                c: parseFloat(truthMatch[2] ?? '0.9'),
            };
        }
        return undefined;
    }

    getCache(): TranslationCache {
        return this.cache;
    }
}
