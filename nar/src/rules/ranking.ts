export interface RankableDerivation {
    term: { toString(): string };
    truth?: { f: number; c: number } | null;
}

export interface RankingOptions {
    maxAdmissions?: number;
    minScore?: number;
}

export const DEFAULT_MAX_ADMISSIONS = 100;
export const DEFAULT_MIN_SCORE = 0;

export function scoreDerivation(termString: string, f: number, c: number): number {
    const decisiveness = Math.abs(f - 0.5) * 2;
    const sizePenalty = Math.min(0.3, termString.length / 2000);
    return c * decisiveness - sizePenalty;
}

export function rankDerivations<T extends RankableDerivation>(results: T[], opts: RankingOptions = {}): T[] {
    const maxAdmissions = opts.maxAdmissions ?? DEFAULT_MAX_ADMISSIONS;
    const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
    return results
        .map((task) => {
            const s = task.term.toString();
            const score = task.truth ? scoreDerivation(s, task.truth.f, task.truth.c) : -1;
            return { task, score };
        })
        .filter(({ score }) => score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxAdmissions)
        .map(({ task }) => task);
}
