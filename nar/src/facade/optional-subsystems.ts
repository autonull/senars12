/**
 * Optional subsystems, each present only when its config says so.
 *
 * Four config-gated constructions that share one shape: absent config means the
 * NAR does not hold the subsystem at all, rather than holding a disabled
 * instance every caller has to null-check twice — once here, once at use.
 */

import { MiningBag } from '../lm/system-one/hard-negatives.js';
import { EpisodeConsolidator } from '../memory/episode-consolidator.js';
import { ProofMettaProposer } from '../meta/index.js';
import type { NARConfig } from '../nar.js';
import { RLFPLearner } from '../rlfp';
import type { RandomSource } from '../types/primitives.js';

export interface OptionalSubsystems {
  rlfp: RLFPLearner | undefined;
  episodeConsolidator: EpisodeConsolidator | undefined;
  miningBag: MiningBag | undefined;
  proofMettaProposer: ProofMettaProposer | undefined;
}

export const createOptionalSubsystems = (config: NARConfig, rng?: RandomSource): OptionalSubsystems => {
  const consolidation = config.episodeConsolidation;
  const mining = config.hardNegativeMining;
  const proposer = config.proofMettaProposer;

  return {
    rlfp: config.enableRLFP
      ? new RLFPLearner({ optimizeInterval: config.rlfp?.optimizeInterval, rng })
      : undefined,
    episodeConsolidator: consolidation?.enabled
      ? new EpisodeConsolidator({
          capacity: consolidation.capacity,
          budget: consolidation.budget,
          rng,
        })
      : undefined,
    miningBag: mining?.bounded
      ? new MiningBag({
          capacity: mining.capacity,
          budget: mining.budget,
          marginFloor: mining.marginFloor,
          rng,
        })
      : undefined,
    proofMettaProposer: proposer?.enabled
      ? new ProofMettaProposer({
          maxRules: proposer.maxRules,
          minConfidence: proposer.minConfidence,
          patternMinSupport: proposer.patternMinSupport,
        })
      : undefined,
  };
};