/**
 * The embedding runtime's view of provider settings.
 *
 * `nar/src/memory/embedding.ts` owns the embedder and declares what it is
 * allowed to know about its host (`EmbeddingRuntime`); this is the one place
 * that answers. Keeping the read here is what lets the core stop importing the
 * induction layer for a configuration value (TODO29.a §5.2).
 */

import type { EmbeddingRuntime } from '../memory/embedding.js';
import { detectDevice, getLMSettings } from './providers.js';

export const embeddingRuntime = (): EmbeddingRuntime => {
  const settings = getLMSettings();
  return {
    provider: settings.provider,
    device: detectDevice(),
    dtype: settings.dtype,
    quantized: settings.quantized,
    cacheDir: settings.cacheDir,
  };
};