import { promises as fs } from 'node:fs';
import type { EpisodeType } from '@senars/nar';
import { createMockLMService } from '@senars/nar';
import { MockEmbeddingGenerator } from '@senars/nar/memory/embedding';
import { consolidateEpisodes } from '@senars/nar/memory/retrieval-verified';
import { afterAll, describe, expect, it } from 'vitest';
import { EpisodicMemory } from '../../../nar/src/memory/EpisodicMemory.js';

const dir = '.cache/test-episodes-retrieval';

describe('retrieval-verified memory consolidation', () => {
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('promotes relevant episodes and dedupes accounting consistently', async () => {
    const episodic = new EpisodicMemory({ basePath: dir, enabled: true });
    const interaction = 'dialogue' as EpisodeType;
    await episodic.log(interaction, 'The user prefers concise answers.');
    await episodic.log(interaction, 'The API key rotation happens monthly.');
    await episodic.log(interaction, 'asdkjh qwerty filler noise');
    await episodic.log(interaction, 'The user prefers brief answers.');

    // mock LM: score array matching the four entries in order
    const lm = createMockLMService({ generateTextFn: () => '[0.9, 0.9, 0.1, 0.9]' });
    const promoted: string[] = [];
    const result = await consolidateEpisodes(
      {
        episodic,
        lm,
        embeddings: new MockEmbeddingGenerator(),
        promote: (content) => void promoted.push(content),
      },
      { relevanceThreshold: 0.5, dedupeThreshold: 0.99 }
    );
    expect(result.considered).toBe(4);
    expect(result.relevant).toBe(3);
    expect(result.promoted.length + result.deduped).toBe(3);
    expect(promoted.length).toBe(result.promoted.length);
    for (const p of result.promoted) {
      expect(p.provenance.source).toBe('episodic');
      expect(Array.isArray(p.provenance.timestamps)).toBe(true);
    }
  });

  it('returns an empty result with no episodes', async () => {
    const episodic = new EpisodicMemory({ basePath: '.cache/test-episodes-empty', enabled: true });
    const lm = createMockLMService({ generateTextFn: () => '[]' });
    const result = await consolidateEpisodes(
      {
        episodic,
        lm,
        embeddings: new MockEmbeddingGenerator(),
        promote: () => undefined,
      },
      { limit: 5 }
    );
    expect(result.considered).toBe(0);
    expect(result.promoted).toEqual([]);
  });
});
