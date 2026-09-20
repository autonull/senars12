import { test, expect } from 'vitest';
import { createGroundednessGate } from '@senars/nar/lm/system-one/groundedness-gate.js';
import { createManifold } from '@senars/nar/lm/system-one/manifold.js';
import { createEmbeddingCache } from '@senars/nar/lm/system-one/embedding-cache.js';

test('createGroundednessGate returns a function', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 0 });
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  expect(typeof gate).toBe('function');
});

test('groundedness gate returns false for ungrounded narration (score < threshold)', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 0 });
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  const result = await gate('This is an ungrounded narration with no evidence.');
  expect(result).toBe(false);
});

test('groundedness gate returns false on abstention (fail-safe)', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 1.0 }); // Always abstains
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  const result = await gate('This narration will cause abstention.');
  expect(result).toBe(false);
});