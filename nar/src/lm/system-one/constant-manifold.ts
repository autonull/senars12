import type {
  BackendId,
  CalibrationVersion,
  ConsensusResult,
  EmbeddingPointer,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ModelDigest,
  ReasoningBudget,
  QueryId,
} from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { validateBatchQueries } from './algebra.js';

interface ConstantManifoldConfig {
  tier: 0 | 3;
  backendId: BackendId;
  modelDigest: ModelDigest;
  calibrationVersion: CalibrationVersion;
  /** Probability mass on the first classify option; remainder spread evenly over the rest. */
  topP: number;
  ece: number;
  latencyMs: number;
  entropy: number;
}

/** One constant-table manifold covers the tier-0 deterministic and tier-3 symbolic stubs (G3/X5). */
export class ConstantManifold implements JudgmentManifold {
  readonly #config: ConstantManifoldConfig;

  constructor(config: ConstantManifoldConfig) {
    this.#config = config;
  }

  async judgeBatch(
    _sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    _budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    validateBatchQueries(queries);
    return queries.map((q) => this.#judge(q));
  }

  async consensus(
    _sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    _k: number,
    _budget: ReasoningBudget
  ): Promise<ConsensusResult> {
    validateBatchQueries([query]);
    return { proposition: this.#judge(query), agreement: 1.0, independent: true };
  }

  health(): ManifoldHealth {
    return {
      backendId: this.#config.backendId,
      ready: true,
      breakerOpen: false,
      rollingEce: this.#config.ece,
      queueDepth: 0,
    };
  }

  #judge(query: JudgmentQuery): JudgmentProposition {
    const { backendId, modelDigest, calibrationVersion, topP, ece, latencyMs, entropy, tier } = this.#config;
    const base: Omit<JudgmentProposition, 'kind' | 'axis' | 'distribution' | 'top' | 'entropy' | 'score'> = {
      queryId: uuidv4() as QueryId,
      backendId,
      modelDigest,
      calibration: { version: calibrationVersion, ece },
      latencyMs,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: latencyMs, memoryMb: 0 },
      tier,
      abstained: false,
    };

    if (query.kind === 'classify') {
      const space = query.space;
      const dist = space.map((option, i) => ({
        option,
        p: i === 0 ? topP : topP === 1.0 ? 0.0 : (1 - topP) / Math.max(1, space.length - 1),
      }));
      return { ...base, kind: 'classify', axis: query.axis, distribution: dist, top: { option: space[0] ?? 'unknown', p: topP }, entropy };
    }
    return { ...base, kind: 'evaluate', axis: query.axis, score: 0.5 };
  }
}

const DETERMINISTIC_CONFIG: ConstantManifoldConfig = {
  tier: 0,
  backendId: 'deterministic-tier0' as BackendId,
  modelDigest: 'sha256:deterministic' as ModelDigest,
  calibrationVersion: 'v1.0.0' as CalibrationVersion,
  topP: 1.0,
  ece: 0.0,
  latencyMs: 0,
  entropy: 0.0,
};

const SYMBOLIC_CONFIG: ConstantManifoldConfig = {
  tier: 3,
  backendId: 'symbolic-tier3' as BackendId,
  modelDigest: 'sha256:symbolic' as ModelDigest,
  calibrationVersion: 'v1.0.0' as CalibrationVersion,
  topP: 0.8,
  ece: 0.05,
  latencyMs: 1,
  entropy: 0.5,
};

export class DeterministicManifold extends ConstantManifold {
  constructor() {
    super(DETERMINISTIC_CONFIG);
  }
}

export class Tier3SymbolicManifold extends ConstantManifold {
  constructor() {
    super(SYMBOLIC_CONFIG);
  }
}
