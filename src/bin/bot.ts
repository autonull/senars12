/**
 * SeNARS Bot — unified interactive entry point (re-exports from modular structure).
 *
 * This is a thin wrapper for backward compatibility. The actual implementation
 * lives in `src/bin/bot/index.ts` and its sibling modules.
 *
 * @deprecated Use `senars run` instead. This entry point will be removed in a future version.
 */

import { createLogger } from '@senars/util/logger';

// Deprecation warning
const logger = createLogger({ scope: 'bot' });
logger.warn('DEPRECATION: `senars-legacy` / `bot` is deprecated. Use `senars run` instead.');

export { main } from './bot/index.js';