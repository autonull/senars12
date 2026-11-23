/** Shared constants for System One commands. */

import type { BotRuntime } from '../context';

export const DEFAULT_DECIDE_RUBRICS = [
  'relevance',
  'groundedness',
  'injection',
  'ambiguity',
  'plausibility',
] as const;

export const EVAL_SET_PATH = '.cache/systemone/eval-set.json';
export const DEFAULT_DATASET_PATH = '.cache/systemone/dataset.jsonl';

export const datasetPathOf = (rt: BotRuntime): string =>
  rt.appConfig.systemOne?.distillation?.datasetPath ?? DEFAULT_DATASET_PATH;

export const systemOneOf = (rt: BotRuntime) =>
  rt.wired.nar as unknown as {
    systemOne?: { dataset?: { size: number; all(): ReadonlyArray<{ source: string }> } };
  };