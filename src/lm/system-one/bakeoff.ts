/**
 * L3 Bake-off: shared vs per-game heads.
 * Compares a shared head (with game features) against per-game heads on held-out Brier.
 */

import { groupBy } from '@senars/util/collections';
import { SenarsError } from '../../errors/senars-error';
import { clamp01 } from '@senars/util/numeric';
import { meanBrierOf } from './metrics';
import { holdoutSplit, mulberry32 } from '@senars/util/random';
import { exportArtifacts } from './head-artifacts';
import type { TrainingRow, HeadIdentity, TrainedHeadModel, TrainingOptions, SharedHeadBakeOffOptions, SharedHeadBakeOffResult } from './types';
import { trainHead } from './head-training';
import { TrainedLinearHead } from './trained-head';

const brierOn = (
  score: (embedding: Float32Array, action: string, game?: string) => number,
  rows: readonly TrainingRow[]
): number =>
  meanBrierOf(
    rows,
    (row) => score(row.embedding, row.action, row.game),
    (row) => clamp01(row.target)
  );

/** Inference head from a trained model — round-trips through the real artifact/scoring path. */
const toHead = (model: TrainedHeadModel): TrainedLinearHead =>
  TrainedLinearHead.fromBundle(exportArtifacts(model));

/**
 * L3 (TODO19): train one shared `reflex_value` head across all registry games
 * (with a dense hashed `game` feature block) against one head per game, and
 * compare held-out Brier on identical per-game holdout splits. Deterministic.
 */
export function bakeOffSharedHead(
  rows: readonly TrainingRow[],
  meta: HeadIdentity,
  options: SharedHeadBakeOffOptions = {}
): SharedHeadBakeOffResult {
  if (rows.some((row) => !row.game)) throw new SenarsError('Bake-off rows must carry a `game` tag', 'VALIDATION_ERROR');
  const byGame = groupBy(rows, (row) => row.game!);
  if (byGame.size < 2) throw new SenarsError(`Bake-off requires ≥2 games, got ${byGame.size}`, 'VALIDATION_ERROR');

  const rng = mulberry32(options.seed ?? 42);
  // One map, not a train/holdout pair: each game contributes one split, and a
  // shared `rng` makes the iteration order part of the result — so this stays a
  // `Map`, whose order is insertion order. An object would reorder integer-like
  // game names and silently reshuffle which rows land in which half.
  const splits = new Map<string, { holdout: TrainingRow[]; train: TrainingRow[] }>();
  for (const [game, gameRows] of byGame) {
    splits.set(game, holdoutSplit(gameRows, options.holdoutFraction ?? 0.2, rng));
  }

  const pooledTrain = [...splits.values()].flatMap((split) => split.train);
  const shared = trainHead(pooledTrain, meta, {
    ...options,
    gameFeatureDim: options.gameFeatureDim ?? 8,
  });
  const perGame: Record<string, TrainedHeadModel> = {};
  const scores: SharedHeadBakeOffResult['scores'] = {};
  let sharedWinsAll = true;
  for (const [game, split] of splits) {
    perGame[game] = trainHead(split.train, meta, {
      ...options,
      gameFeatureDim: 0,
      seed: (options.seed ?? 42) ^ game.length,
    });
    const sharedHead = toHead(shared);
    const gameHead = toHead(perGame[game]!);
    const sharedBrier = brierOn((e, a) => sharedHead.score(e, a, game), split.holdout);
    const perGameBrier = brierOn((e, a) => gameHead.score(e, a), split.holdout);
    scores[game] = { shared: sharedBrier, perGame: perGameBrier };
    if (sharedBrier > perGameBrier) sharedWinsAll = false;
  }
  return { shared, perGame, scores, verdict: sharedWinsAll ? 'shared' : 'per-game' };
}