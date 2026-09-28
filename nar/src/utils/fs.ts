/**
 * Filesystem helpers — re-exported from `@senars/util` so every package
 * ensures directories and reads/writes JSON through one implementation.
 */

export {
  appendJsonlAsync,
  ensureDir,
  ensureDirSync,
  ensureParentDir,
  ensureParentDirSync,
  readJsonFile,
  readJsonFileSync,
  readJsonlAsync,
  writeJsonFile,
  writeJsonFileSync,
} from '@senars/util';
