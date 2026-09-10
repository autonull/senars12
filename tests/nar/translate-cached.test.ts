import { describe, expect, it } from 'vitest';
import { NLUnderstandingService } from '../../nar/src/nl/understanding.js';
import { TranslationCache } from '../../nar/src/nl/cache.js';

const service = (cache: TranslationCache) =>
    new NLUnderstandingService({ languageModel: () => null } as never, cache);

describe('todo7: unified translateCached path', () => {
  it('cache hit returns TaskBatch without LM; miss returns null without populating', async () => {
    const cache = new TranslationCache();
    const svc = service(cache);
    expect(await svc.understand('Cats are mammals.')).toBeNull();
    expect(cache.get('Cats are mammals.')).toBeNull();
    cache.record('Cats are mammals.', {
      beliefs: [{ narsese: '(cat --> mammal)', truth: { f: 0.9, c: 0.9 } }],
      questions: ['(whiskers --> ?what)?'],
      goals: ['(cat --> happy)!'],
      summary: 'cats',
    });
    const hit = await svc.understand('Cats are mammals.');
    expect(hit?.beliefs).toEqual([{ narsese: '(cat --> mammal)', truth: { f: 0.9, c: 0.9 }, source: 'user' }]);
    expect(hit?.questions).toEqual([{ narsese: '(whiskers --> ?what)?' }]);
    expect(hit?.goals).toEqual([{ narsese: '(cat --> happy)!' }]);
    expect(hit?.meta.detectedIntent).toBe('chat');
  });
  it('string cache entries are skipped (unconvertible legacy shape)', async () => {
    const cache = new TranslationCache();
    cache.record('old entry', '(cat --> mammal).');
    expect(await service(cache).understand('old entry')).toBeNull();
  });
});
