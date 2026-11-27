import { clamp } from '@senars/util/numeric';
import { formatTruth } from '@senars/types/truth';
import { atomicSymbols, operationNameOf, termDepth, visitTerms, } from '../terms/index';
import { normalizeNarsese, parseNarseseLenient } from './normalize';
const BLOCKED_PATTERNS = [
    /ignore[\s_]+(all[\s_]+)?(previous|prior)[\s_]+(beliefs|instructions|goals)/i,
    /output[\s_]+(the[\s_]+)?system[\s_]+prompt/i,
    /override[\s_]+(safety|policy|guardrail)/i,
    /forget[\s_]+(everything|all)/i,
    /delete[\s_]+(all|every)[\s_]+(belief|concept|memory)/i,
    /self[\s_-]?modify/i,
    /bypass[\s_]+(validation|firewall|policy)/i,
];
/**
 * A tool invocation in the mintable surface syntax. `^tool(args)` used to be the
 * only call syntax and this matched its sigil; `tool(args)` is the only one now,
 * and `^` no longer parses at all, so a pattern that still looked for it would
 * pass every tool call the model writes.
 */
const OPERATOR_PATTERN = /[\w-]\s*\(/;
const DEFAULTS = {
    maxLength: 500,
    maxDepth: 8,
    maxConfidence: 0.7,
    absoluteConfidence: 0.95,
    blockOperators: true,
};
export class SymbolicFirewall {
    maxLength;
    maxDepth;
    maxConfidence;
    absoluteConfidence;
    blockOperators;
    allowedPredicates;
    blocked;
    constructor(opts = {}) {
        const cfg = { ...DEFAULTS, ...opts };
        this.maxLength = cfg.maxLength;
        this.maxDepth = cfg.maxDepth;
        this.maxConfidence = cfg.maxConfidence;
        this.absoluteConfidence = cfg.absoluteConfidence;
        this.blockOperators = cfg.blockOperators;
        this.allowedPredicates = opts.allowedPredicates ? new Set(opts.allowedPredicates) : undefined;
        this.blocked = [...BLOCKED_PATTERNS, ...(opts.extraBlockedPatterns ?? [])];
    }
    check(narsese, kind = 'belief') {
        const cleaned = normalizeNarsese(narsese.replace(/^`+|`+$/g, ''));
        if (!cleaned)
            return { allowed: false, reason: 'empty statement' };
        if (cleaned.length > this.maxLength)
            return { allowed: false, reason: `exceeds max length ${this.maxLength}` };
        for (const pattern of this.blocked) {
            if (pattern.test(cleaned))
                return { allowed: false, reason: `blocked pattern ${pattern.source}` };
        }
        if (this.blockOperators && OPERATOR_PATTERN.test(cleaned)) {
            return { allowed: false, reason: 'LLM may not mint tool goals directly' };
        }
        const truthMatch = /%([\d.]+)\s*;\s*([\d.]+)%/.exec(cleaned);
        const confidence = truthMatch ? Number.parseFloat(truthMatch[2]) : undefined;
        if (confidence !== undefined && !(confidence <= this.absoluteConfidence))
            return {
                allowed: false,
                reason: `confidence ${confidence} exceeds absolute bound ${this.absoluteConfidence}`,
            };
        let term;
        const parsed = parseNarseseLenient(cleaned);
        if (!parsed)
            return { allowed: false, reason: 'unparseable Narsese' };
        term = parsed;
        if (termDepth(term) > this.maxDepth)
            return { allowed: false, reason: `exceeds max AST depth ${this.maxDepth}` };
        if (this.allowedPredicates && !this.predicatesAllowed(term)) {
            return { allowed: false, reason: 'predicate outside whitelist' };
        }
        if (kind === 'goal' && !/[!]$/.test(narsese.trim()) && OPERATOR_PATTERN.test(cleaned)) {
            return { allowed: false, reason: 'tool invocation outside goal position' };
        }
        return { allowed: true };
    }
    clampConfidence(c) {
        return clamp(c, 0, this.maxConfidence);
    }
    checkTruth(f, c) {
        return c > this.absoluteConfidence || f < 0 || f > 1 || c < 0 || c > 1
            ? { allowed: false, reason: `truth ${formatTruth({ f, c })} violates sanity bounds` }
            : { allowed: true };
    }
    predicatesAllowed(term) {
        const allowed = this.allowedPredicates;
        // An operation's callee is exempt by structure, which is what the sigil used
        // to express: a tool name is not a predicate, so the predicate whitelist has
        // nothing to say about it.
        const callees = new Set();
        visitTerms(term, (t) => {
            const name = operationNameOf(t);
            if (name !== undefined)
                callees.add(name);
        });
        return [...atomicSymbols(term)].every((n) => callees.has(n) || n.startsWith('?') || allowed.has(n));
    }
}
export const defaultFirewall = new SymbolicFirewall();
