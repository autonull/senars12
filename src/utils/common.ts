/**
 * Common utilities — frequently used util functions (migrated from @senars/util).
 */

export {
  createLogger,
  ensureDir,
  errMsg,
  type Flags,
  makeId,
  parseFlags,
  setupGracefulShutdown,
  thaw,
  unique,
  finiteOr,
  incrementCount,
  readJsonlAsync,
  writeJsonl,
  removeBy,
  clamp,
  perSecond,
  stopwatch,
  envStr,
  envStrOr,
  envBool,
  envNum,
  envSet,
  envCsv,
  envInt,
  cachePath,
  formatDuration,
  formatBytes,
  pct,
  section,
  writeJsonFile,
  parseJsonOr,
  type ReadOnlyLookup,
  takeLast,
  sleep,
  escapeRegExp,
  divider,
  splitWords,
  getNested,
  parseEnvValue,
  degrade,
  truncate,
  limitList,
  formatTruth,
  flooredRatio,
  splitLines,
  bar,
  formatNarseseTruth,
  generateId,
} from '@senars/util';
export { positiveInt } from '@senars/util/config';
export { ConfigurationError } from '@senars/util/errors';
export type { LMTask, LMExecutionStats, ConversationSession, SessionManager, Teardown, HealthReport } from '@senars/util';
export { SlidingWindowRateLimiter, keyedBy, mapValues, LM_TASKS, BoundedMap, mean, selectTopN, entryKey, sumBy, filterFolded } from '@senars/util';
export { evaluateExpression } from '@senars/util/utils/eval.js';

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