/** @public One `(state, action)` estimate store for every tabular policy. */
export type { ConfidenceCurve, Exploration, QEntry, QUpdate } from '../bandit';
export {
  greedy,
  isYoung,
  lerpUpdate,
  meanUpdate,
  QTable,
  rampConfidence,
  UNVISITED,
  ucb,
  visitConfidence,
} from '../bandit';