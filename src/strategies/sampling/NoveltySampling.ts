import { defineScoredSampling } from './scored.js';

export const NoveltySampling = defineScoredSampling({
  name: 'novelty',
  description: 'Bias toward least-recently-accessed concepts',
  score: (c) => -(c.lastAccessedAt ?? 0),
});
