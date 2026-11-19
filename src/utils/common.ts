/**
 * Common utilities — frequently used util functions (migrated from @senars/util).
 */

export { createLogger } from '@senars/util/logger';
export { ensureDir, readJsonlAsync, writeJsonl, writeJsonFile, parseJsonOr } from '@senars/util/fs';
export { errMsg, degrade } from '@senars/util/error';
export { makeId, generateId } from '@senars/util/id';
export { parseFlags } from '@senars/util/cli';
export { setupGracefulShutdown } from '@senars/util/shutdown';
export { thaw, getNested } from '@senars/util/object';
export { unique, incrementCount, removeBy, takeLast } from '@senars/util/collections';
export { finiteOr, clamp, perSecond, pct, flooredRatio } from '@senars/util/numeric';
export { stopwatch, sleep } from '@senars/util/async';
export { envStr, envStrOr, envBool, envNum, envSet, envCsv, envInt, cachePath, parseEnvValue } from '@senars/util/config';
export { formatDuration, formatBytes, section, divider, bar } from '@senars/util/format';
export { escapeRegExp, splitWords, truncate, limitList, splitLines } from '@senars/util/text';
export { formatTruth, formatNarseseTruth } from '@senars/util/truth-schema';
export { positiveInt } from '@senars/util/config';
export { ConfigurationError } from '@senars/errors';
export type { LMTask, LMExecutionStats } from '@senars/types/llm';
export type { ConversationSession, SessionManager } from '@senars/types/memory';
export type { Teardown } from '@senars/util/disposal';
export type { HealthReport } from '@senars/types/health';
export { SlidingWindowRateLimiter } from '@senars/util/rate-limit';
export type { keyedBy, mapValues, selectTopN, entryKey } from '@senars/util/collections';
export { LM_TASKS } from '@senars/types/llm';
export type { BoundedMap } from '@senars/util/bounded-map';
export { mean, sumBy } from '@senars/util/numeric';
export { filterFolded } from '@senars/util/text';
export { evaluateExpression } from '@senars/util/eval.js';

// CLI-specific utilities (from src/bin/commands/args.ts)
export {
  tokenize,
  flagsOf,
  setPath,
  coerce,
  onOff,
  jsonMode,
  renderReport,
  dispatchSub,
  ratioArg,
  positiveArg,
} from '../bin/commands/args.js';