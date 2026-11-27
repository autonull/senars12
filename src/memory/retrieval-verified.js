import { parseJsonOr } from '@senars/util/fs';
import { takeFirst } from '@senars/util/collections';
import { cosineUnit, l2Normalize } from '@senars/util/similarity';
const DEFAULTS = { limit: 50, relevanceThreshold: 0.5, dedupeThreshold: 0.9 };
const extractRelevance = (reply, count) => {
    const match = /\[[\s\S]*\]/.exec(reply);
    if (!match)
        return [];
    const parsed = parseJsonOr(match[0], []);
    return takeFirst(parsed, count).map((v) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0));
};
/**
 * Retrieval-verified long-term memory consolidation:
 * store → episodic recall → LM relevance filter (structured tier) →
 * embedding-similarity dedupe → promotion of durable semantic beliefs.
 * Provenance (episode timestamps) is logged on every promotion.
 */
export const consolidateEpisodes = async (deps, options) => {
    const { limit = 50, relevanceThreshold = 0.5, dedupeThreshold = 0.9, type } = options ?? {};
    const episodes = await deps.episodic.getEpisodes({ limit, type });
    if (episodes.length === 0) {
        return { considered: 0, relevant: 0, promoted: [], deduped: 0 };
    }
    const reply = await deps.lm.generateText([
        'Rate the durable-knowledge relevance of each conversation entry for long-term memory.',
        'Return ONLY a JSON array of relevance scores (0..1), one per entry, in order.',
        '',
        ...episodes.map((e, i) => `[${i}] ${e.content}`),
    ].join('\n'), { task: 'structured' });
    const relevances = extractRelevance(reply, episodes.length);
    const candidates = episodes
        .map((e, i) => ({ episode: e, relevance: relevances[i] ?? 0 }))
        .filter((c) => c.relevance >= relevanceThreshold);
    const promoted = [];
    const keptUnits = [];
    let deduped = 0;
    for (const c of candidates) {
        const content = c.episode.content;
        // Unit-length once per candidate, so the pairwise scan is a dot product
        // rather than a fresh norm pass on both sides of every comparison.
        const unit = l2Normalize(await deps.embeddings.generate(content));
        const duplicate = keptUnits.some((v) => cosineUnit(unit, v) >= dedupeThreshold);
        if (duplicate) {
            deduped++;
            continue;
        }
        keptUnits.push(unit);
        const provenance = {
            source: 'episodic',
            timestamps: [c.episode.timestamp],
            type: c.episode.type,
        };
        await deps.promote(content, provenance);
        promoted.push({ content, provenance });
    }
    return { considered: episodes.length, relevant: candidates.length, promoted, deduped };
};
