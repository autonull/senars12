import {classify} from '../../nar/nl/classifier.js';
import {NLAnalyzer} from '../../nar/nl/analyzer.js';
import {termParser} from '../../nar/terms/index.js';
import type {Route, RouteSignal, RouteKind} from '../types.js';

const REASON_TRIGGERS = /^(why|how|because|therefore|hence|deduce|infer|prove|multi-?hop)\b/i;
const QUESTION_TRIGGERS = /^(what|who|where|when|is|are|do|does|can|could|should|would|will)\b.*\?$/i;

const analyzer = new NLAnalyzer();

export interface RouteContext {
    sender?: string;
    channel?: string;
    reasoningDepth?: number;
}

export function route(input: string, ctx: RouteContext = {}): Route {
    const trimmed = input.trim();
    if (!trimmed) return fallbackRoute('nl', 'empty input', 0.1);

    const classifierKind = classify(trimmed);
    const analysis = analyzer.analyze(trimmed);
    const signals: RouteSignal[] = [
        {source: 'classifier', name: classifierKind, weight: 0.7},
        ...analysis.intents.map(i => ({
            source: 'nl-analyzer' as const,
            name: i.type,
            weight: 0.2 + Math.min(0.3, i.priority * 0.05),
        })),
    ];

    const kind = pickKind(trimmed, classifierKind, analysis);
    const concepts = dedupe(analysis.concepts);

    if (kind === 'narsese-belief' || kind === 'narsese-question') {
        const parsed = tryParse(trimmed);
        if (parsed) signals.push({source: 'narsese-parser', name: 'parse-ok', weight: 0.95});
        return {
            kind,
            confidence: analysis.confidence,
            signals,
            narsese: parsed ? trimmed : undefined,
            concepts,
        };
    }

    if (kind === 'command') {
        const cmd = trimmed.replace(/^\.+/, '').trim();
        const args = cmd.split(/\s+/).slice(1);
        return {kind: 'command', confidence: 0.95, signals, command: args.length ? cmd.split(/\s+/)[0]! : cmd, arguments: args};
    }

    if (REASON_TRIGGERS.test(trimmed) || (QUESTION_TRIGGERS.test(trimmed) && analysis.confidence < 0.5)) {
        signals.push({source: 'pattern', name: 'reason-trigger', weight: 0.6});
    }

    return {
        kind: 'nl',
        confidence: analysis.confidence,
        signals,
        intent: analysis.intents[0]?.type ?? (trimmed.endsWith('?') ? 'query' : 'believe'),
        concepts,
        ambiguity: analysis.ambiguity.length,
    };
}

function pickKind(trimmed: string, classifierKind: string, analysis: ReturnType<NLAnalyzer['analyze']>): RouteKind {
    if (classifierKind === 'command') return 'command';
    if (classifierKind === 'narsese-belief' && analysis.isNarsese) return 'narsese-belief';
    if (classifierKind === 'narsese-question' && analysis.isNarsese) return 'narsese-question';
    return 'nl';
}

function tryParse(input: string): boolean {
    try {
        termParser.parseWithTruth(input);
        return true;
    } catch {
        try {
            termParser.parse(input);
            return true;
        } catch {
            return false;
        }
    }
}

function dedupe(concepts: string[]): string[] {
    return [...new Set(concepts)];
}

function fallbackRoute(kind: RouteKind, name: string, weight: number): Route {
    return {
        kind,
        confidence: weight,
        signals: [{source: 'fallback', name, weight}],
        concepts: [],
    } as Route;
}
