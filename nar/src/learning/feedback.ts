import type {TranslationCache} from '../nl';
import type {RLFPLearner} from '../rlfp';
import {getPredicate, getSubject, isOperation, isTautology} from '../terms';
import type {Task} from '../types';

interface DerivationResult {
    steps?: number;
    newBeliefs: Array<{ term: string }>;
}

export interface CorrectionEntry {
    pattern: string;
    narsese: string;
    count: number;
    timestamp: number;
}

export interface RuleStats {
    accepted: number;
    rejected: number;
}

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

export class FeedbackLearner {
    private corrections = new Map<string, CorrectionEntry>();
    private ruleStats = new Map<string, RuleStats>();
    private translationCache?: TranslationCache;
    private rlfp?: RLFPLearner;

    setTranslationCache(cache: TranslationCache): void {
        this.translationCache = cache;
    }

    setRLFP(rlfp: RLFPLearner): void {
        this.rlfp = rlfp;
    }

    onCorrection(originalNL: string, originalNarsese: string, correctedNarsese: string): void {
        const pattern = this.extractPattern(originalNL);
        const existing = this.corrections.get(pattern);
        this.corrections.set(pattern, {
            pattern,
            narsese: correctedNarsese,
            count: (existing?.count ?? 0) + 1,
            timestamp: Date.now(),
        });

        this.translationCache?.record(originalNL, {
            beliefs: [{narsese: correctedNarsese}],
            questions: [],
            goals: [],
            summary: originalNL,
        });

        this.rlfp?.addPreference(correctedNarsese, originalNarsese);
    }

    onDerivationOutcome(derivation: DerivationResult, outcome: 'accepted' | 'rejected'): void {
        const ruleIds = this.extractRuleIds(derivation);
        for (const ruleId of ruleIds) {
            const stats = this.ruleStats.get(ruleId) ?? {accepted: 0, rejected: 0};
            stats[outcome]++;
            this.ruleStats.set(ruleId, stats);
        }
    }

    getCorrection(nl: string): string | null {
        const pattern = this.extractPattern(nl);
        return this.corrections.get(pattern)?.narsese ?? null;
    }

    getAdjustedPriority(ruleId: string, base: number): number {
        const stats = this.ruleStats.get(ruleId);
        if (!stats || stats.accepted + stats.rejected < 5) return base;
        const rate = stats.accepted / (stats.accepted + stats.rejected);
        return Math.max(0.1, Math.min(1.0, base + (rate - 0.5) * 0.2));
    }

    getStats(): {
        corrections: number;
        rulesTracked: number;
        topCorrections: Array<{ pattern: string; count: number }>;
    } {
        const entries = [...this.corrections.values()].sort((a, b) => b.count - a.count);
        return {
            corrections: this.corrections.size,
            rulesTracked: this.ruleStats.size,
            topCorrections: entries.slice(0, 5).map((e) => ({pattern: e.pattern, count: e.count})),
        };
    }

    getRuleStats(): Map<string, RuleStats> {
        return new Map(this.ruleStats);
    }

    private extractPattern(nl: string): string {
        return nl
            .toLowerCase()
            .replace(/\b(the|a|an|is|are|was|were|that|this|these|those)\b/g, '')
            .replace(/[.!?]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractRuleIds(derivation: DerivationResult): string[] {
        const ruleIds: string[] = [];
        for (const belief of derivation.newBeliefs) {
            if (belief.term && typeof belief.term === 'string') {
                const match = belief.term.match(/rule:([a-z0-9-]+)/i);
                if (match?.[1]) ruleIds.push(match[1]);
            }
        }
        return ruleIds.length > 0 ? ruleIds : ['unknown'];
    }
}

export function validateLMOutput(
    task: Task,
    memory: { getBeliefs: () => Task[] }
): ValidationResult {
    if (!task.term) {
        return {valid: false, reason: 'Malformed term'};
    }

    if (isTautology(task.term)) {
        return {valid: false, reason: 'Tautology'};
    }

    if (task.type === 'belief' && isOperation(task.term)) {
        return {valid: false, reason: 'Operation in declarative'};
    }

    if (task.type === 'belief' && task.term.args && task.term.args.length > 0) {
        const s = getSubject(task.term);
        const p = getPredicate(task.term);
        if (s && isOperation(s)) return {valid: false, reason: 'Operation in subject'};
        if (p && isOperation(p)) return {valid: false, reason: 'Operation in predicate'};
    }

    const conflicts = findConflicts(task.term, memory);
    if (conflicts.length > 0 && task.truth && task.truth.c < 0.3) {
        return {valid: false, reason: `Conflicts with ${conflicts.length} beliefs`};
    }

    return {valid: true};
}

function findConflicts(
    term: { toString: () => string },
    memory: { getBeliefs: () => Task[] }
): Task[] {
    const termStr = term.toString();
    return memory.getBeliefs().filter((b) => {
        const bStr = b.term.toString();
        if (bStr === termStr) return true;
        if (bStr.startsWith('--(') && bStr.includes(termStr.replace('--(', '').replace(')', '')))
            return true;
        return false;
    });
}
