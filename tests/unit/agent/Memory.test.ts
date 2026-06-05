import {recallEpisodes, type Episode} from '../../../src/agent/cycle/index.js';

const mk = (id: string, input: string, response: string, ageMs: number, tags: string[] = []): Episode => ({
    id,
    input,
    response,
    tags,
    timestamp: Date.now() - ageMs,
});

describe('recallEpisodes()', () => {
    it('returns empty for empty episodes', () => {
        expect(recallEpisodes([], 'cat', 5)).toEqual([]);
    });

    it('returns empty when k <= 0', () => {
        const eps = [mk('a', 'cat', 'meow', 100)];
        expect(recallEpisodes(eps, 'cat', 0)).toEqual([]);
    });

    it('prefers recent episodes', () => {
        const eps = [
            mk('old', 'cat', 'meow', 10000),
            mk('new', 'dog', 'woof', 100),
        ];
        const result = recallEpisodes(eps, 'animal', 1);
        expect(result[0]?.id).toBe('new');
    });

    it('boosts matches for query terms', () => {
        const eps = [
            mk('old-match', 'cat sat on mat', 'feline', 10000),
            mk('new-nomatch', 'truck', 'vehicle', 100),
        ];
        const result = recallEpisodes(eps, 'cat mat', 1);
        expect(result[0]?.id).toBe('old-match');
    });

    it('respects k limit', () => {
        const eps = [
            mk('a', 'cat', '1', 100),
            mk('b', 'cat', '2', 200),
            mk('c', 'cat', '3', 300),
        ];
        expect(recallEpisodes(eps, 'cat', 2)).toHaveLength(2);
    });
});
