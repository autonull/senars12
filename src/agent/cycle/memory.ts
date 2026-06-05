import type {Episode} from './State.js';

export const recallEpisodes = (
    episodes: readonly Episode[],
    query: string,
    k: number,
): readonly Episode[] => {
    if (episodes.length === 0 || k <= 0) return [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = episodes.map(ep => {
        const text = `${ep.input} ${ep.response} ${ep.tags.join(' ')}`.toLowerCase();
        const matchCount = queryTerms.reduce(
            (n, term) => n + (text.includes(term) ? 1 : 0),
            0,
        );
        const ageMs = Date.now() - ep.timestamp;
        const recencyScore = 1 / (1 + ageMs / 60000);
        const matchScore = queryTerms.length === 0 ? 0 : matchCount / queryTerms.length;
        return {ep, score: 0.7 * recencyScore + 0.3 * matchScore};
    });
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map(s => s.ep);
};
