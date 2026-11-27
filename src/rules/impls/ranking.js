import { rankBy } from '@senars/util/collections';
export const DEFAULT_MAX_ADMISSIONS = 100;
export const DEFAULT_MIN_SCORE = 0;
export function scoreDerivation(termString, f, c) {
    const decisiveness = Math.abs(f - 0.5) * 2;
    const sizePenalty = Math.min(0.3, termString.length / 2000);
    return c * decisiveness - sizePenalty;
}
export function rankDerivations(results, opts = {}) {
    return rankBy(results, (task) => task.truth ? scoreDerivation(task.term.toString(), task.truth.f, task.truth.c) : -1, {
        where: (_task, score) => score >= (opts.minScore ?? DEFAULT_MIN_SCORE),
        limit: opts.maxAdmissions ?? DEFAULT_MAX_ADMISSIONS,
    });
}
