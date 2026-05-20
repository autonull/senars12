import type {NAR} from '../nar.js';
import type {DerivationResult, Belief} from '../../agent/BotContext.js';

interface DerivationSummary {
    conclusion: string;
    reasoningType: string;
    keyPremises: string[];
    wouldBenefitFrom: string[];
}

interface ConflictInfo {
    belief: Belief;
    conflictWith: Belief;
    type: 'direct' | 'frequency' | 'implication';
}

export class ResultInterpreter {
    interpret(
        derivation: DerivationResult | null,
        query: string,
        nar: NAR,
    ): string {
        if (!derivation || derivation.newBeliefs.length === 0) {
            return this.handleUnknown(query, nar);
        }

        const conflicts = this.findConflicts(derivation, nar);
        if (conflicts.length > 0) {
            return this.explainConflict(derivation, conflicts, nar);
        }

        return this.explainDerivation(derivation, nar);
    }

    private explainDerivation(derivation: DerivationResult, nar: NAR): string {
        const summary = this.summarizeChain(derivation, nar);
        const bestBelief = derivation.newBeliefs[0];
        const hedge = bestBelief?.truth ? truthToNL(bestBelief.truth) : 'I believe that';

        let result = `${hedge}: ${summary.conclusion}. `;
        result += `Derived via ${summary.reasoningType}`;
        if (summary.keyPremises.length > 0) {
            result += ` from ${summary.keyPremises.slice(0, 3).join(', ')}`;
        }
        result += '.';

        if (summary.wouldBenefitFrom.length > 0) {
            result += ` Would be stronger if I knew: ${summary.wouldBenefitFrom.slice(0, 3).join(', ')}.`;
        }

        return result;
    }

    private handleUnknown(query: string, nar: NAR): string {
        const related = nar.getBeliefs().filter(b =>
            b.term.toString().toLowerCase().includes(query.toLowerCase()),
        ).slice(0, 3);

        const parts: string[] = [];
        parts.push(`I don't have enough information about "${query}".`);

        if (related.length > 0) {
            const relatedStr = related.map(b => this.taskToNL(b)).join('; ');
            parts.push(` I know: ${relatedStr}.`);
        }

        const missing = this.findWhatWouldAnswer(query, nar);
        if (missing.length > 0) {
            parts.push(` If I knew "${missing[0]}", I could answer.`);
        }

        return parts.join('');
    }

    private findConflicts(
        derivation: DerivationResult,
        nar: NAR,
    ): ConflictInfo[] {
        const conflicts: ConflictInfo[] = [];
        const allBeliefs = nar.getBeliefs().map(b => ({
            term: b.term.toString(),
            truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
        }));

        for (const newBelief of derivation.newBeliefs) {
            for (const existing of allBeliefs) {
                if (existing === newBelief) continue;
                const conflict = this.detectConflict(newBelief, existing);
                if (conflict) conflicts.push(conflict);
            }
        }

        return conflicts;
    }

    private detectConflict(a: Belief, b: Belief): ConflictInfo | null {
        const aTerm = a.term;
        const bTerm = b.term;

        if (aTerm === bTerm) {
            const aTruth = a.truth;
            const bTruth = b.truth;
            if (aTruth && bTruth) {
                const freqDiff = Math.abs(aTruth.frequency - bTruth.frequency);
                if (freqDiff > 0.3) {
                    return { belief: a, conflictWith: b, type: 'frequency' };
                }
            }
        }

        if (aTerm.startsWith('--(') && aTerm.includes(bTerm.replace('--(', '').replace(')', ''))) {
            return { belief: a, conflictWith: b, type: 'direct' };
        }

        return null;
    }

    private explainConflict(
        derivation: DerivationResult,
        conflicts: ConflictInfo[],
        nar: NAR,
    ): string {
        const conflict = conflicts[0];
        if (!conflict) return this.explainDerivation(derivation, nar);

        const belief = derivation.newBeliefs[0];
        const hedge = belief?.truth ? truthToNL(belief.truth) : 'It appears that';

        return `${hedge}: ${belief?.term ?? 'unknown'}. ` +
            `However, this conflicts with existing knowledge (${conflict.conflictWith.term}). ` +
            `I need more evidence to resolve this.`;
    }

    private summarizeChain(derivation: DerivationResult, _nar: NAR): DerivationSummary {
        const newBeliefs = derivation.newBeliefs;
        const conclusion = newBeliefs[0]?.term ?? 'unknown';

        const reasoningType = this.classifyReasoning(derivation);

        const keyPremises = newBeliefs.length > 0
            ? newBeliefs.slice(0, 3).map(b => b.term)
            : [];

        const wouldBenefitFrom = this.findWhatWouldStrengthen(conclusion, _nar);

        return { conclusion, reasoningType, keyPremises, wouldBenefitFrom };
    }

    private classifyReasoning(derivation: DerivationResult): string {
        if (derivation.steps === 0) return 'direct observation';
        if (derivation.steps <= 2) return 'simple deduction';
        if (derivation.steps <= 5) return 'multi-step reasoning';
        return 'deep reasoning';
    }

    private findWhatWouldAnswer(_query: string, nar: NAR): string[] {
        const suggestions: string[] = [];
        const concepts = nar.listConcepts().slice(0, 5);

        for (const concept of concepts) {
            const termStr = concept.term.toString();
            if (concept.beliefBag.size === 0) {
                suggestions.push(`more about ${termStr}`);
            }
        }

        return suggestions.slice(0, 3);
    }

    private findWhatWouldStrengthen(conclusion: string, nar: NAR): string[] {
        const suggestions: string[] = [];
        const allBeliefs = nar.getBeliefs();

        for (const belief of allBeliefs) {
            const termStr = belief.term.toString();
            if (termStr.includes('-->') && conclusion.includes('-->')) {
                const subject = termStr.split('-->')[0]?.replace('(', '').trim();
                if (subject && conclusion.includes(subject) && belief.truth && belief.truth.c < 0.8) {
                    suggestions.push(`more evidence about ${subject}`);
                }
            }
        }

        return [...new Set(suggestions)].slice(0, 3);
    }

    private taskToNL(task: { term: { toString(): string }; truth?: { f: number; c: number } }): string {
        const term = task.term.toString();
        const truth = task.truth;
        if (!truth) return term;
        const hedge = truthToNL(truth);
        return `${hedge.toLowerCase()} ${term}`;
    }
}

export function truthToNL(truth: { frequency?: number; confidence?: number; f?: number; c?: number }): string {
    const c = truth.confidence ?? truth.c ?? 0.5;
    if (c > 0.8) return 'I am confident that';
    if (c > 0.6) return 'I believe that';
    if (c > 0.4) return 'It seems that';
    if (c > 0.2) return "I'm not sure, but possibly";
    return 'I have very little evidence for';
}
