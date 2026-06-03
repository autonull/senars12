import type {NAR} from '../../nar/nar.js';
import {termParser} from '../../nar/terms/index.js';
import type {Term} from '../../nar/terms/types.js';

export interface ExtractedTerms {
    parsed: string[];
    fromConcepts: string[];
    byPriority: string[];
}

/**
 * Extract Narsese-relevant terms from an input. Tries the parser first
 * (to find term atoms inside `(...)`); falls back to a Set lookup over
 * the live concept bag.
 */
export function extractTerms(input: string, nar?: NAR): ExtractedTerms {
    const parsed = parseTerms(input);
    const fromConcepts = nar ? intersectWithConcepts(parsed, nar) : [];
    const byPriority = nar ? rankByPriority(parsed, nar) : [];
    return {parsed, fromConcepts, byPriority};
}

function parseTerms(input: string): string[] {
    const atoms = new Set<string>();
    const matches = input.match(/\(([^)]+)\)/g);
    if (matches) {
        for (const m of matches) {
            const inner = m.slice(1, -1);
            const tokens = inner.match(/[A-Za-z_][A-Za-z0-9_]*/g);
            tokens?.forEach(t => atoms.add(t));
        }
    }
    const statements = input.split(/[;\n]+|(?<=\.)\s+/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
        const cleaned = stmt.replace(/[.!?@]+\s*$/, '').trim();
        if (!cleaned) continue;
        try {
            const result = termParser.parseWithTruth(cleaned);
            walk(result.term, atoms);
        } catch {
            try {
                const result = termParser.parse(cleaned);
                walk(result, atoms);
            } catch {
                // ignore: statement is not narsese
            }
        }
    }
    return [...atoms];
}

function walk(term: Term, into: Set<string>): void {
    if (!term) return;
    const name = term.toString();
    if (name && name.length < 64) into.add(name);
    if (term.kind !== 'atom' && term.args) {
        for (const sub of term.args) walk(sub, into);
    }
}

function intersectWithConcepts(candidates: string[], nar: NAR): string[] {
    const known = new Set(nar.listConcepts().map(c => c.term.toString()));
    return candidates.filter(c => known.has(c));
}

function rankByPriority(candidates: string[], nar: NAR): string[] {
    const conceptMap = new Map(nar.listConcepts().map(c => [c.term.toString(), c.priority]));
    return [...candidates].sort((a, b) => (conceptMap.get(b) ?? 0) - (conceptMap.get(a) ?? 0));
}
