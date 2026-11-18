import { test, expect } from 'vitest';
import { createGroundednessGate } from '@senars/lm';
import { createManifold } from '@senars/lm';
import { createEmbeddingCache } from '@senars/lm';

test.skip('createGroundednessGate returns a function — M0 quarantine: M2 owns mechanism rewrite', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 0 });
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  expect(typeof gate).toBe('function');
});

test.skip('groundedness gate returns false for ungrounded narration (score < threshold) — M0 quarantine: M2 owns mechanism rewrite', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 0 });
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  const result = await gate(
    'This is an ungrounded narration with no evidence.',
    'test-correlation'
  );
  expect(result.grounded).toBe(false);
});

test.skip('groundedness gate returns false on abstention (fail-safe) — M0 quarantine: M2 owns mechanism rewrite', async () => {
  const cache = createEmbeddingCache({ maxSize: 100 });
  const manifold = createManifold(cache, { abstainThreshold: 1.0 }); // Always abstains
  const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });

  const result = await gate('This narration will cause abstention.', 'test-correlation');
  expect(result.grounded).toBe(false);
});