import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COGNITIVE_PARAMETERS,
  PARAMETER_SPACE,
  readCognitiveParams,
} from '../../../nar/src/config/cognitive-parameters';

describe('readCognitiveParams — a run’s parameters outlive the process', () => {
  it('reads the tuner’s envelope, which is what `pnpm tune` writes', () => {
    const params = { ...DEFAULT_COGNITIVE_PARAMETERS, inference: { ...DEFAULT_COGNITIVE_PARAMETERS.inference, maxDerivationsPerStep: 7 } };
    const { params: read, errors } = readCognitiveParams(JSON.stringify({ cognitiveParams: params }));

    expect(errors).toEqual([]);
    expect(read.inference.maxDerivationsPerStep).toBe(7);
  });

  it('reads a bare parameter object, which is what a person writes', () => {
    const { params, errors } = readCognitiveParams(
      JSON.stringify({ inference: { maxDerivationsPerStep: 3 } })
    );

    expect(errors).toEqual([]);
    expect(params.inference.maxDerivationsPerStep).toBe(3);
    // Everything unnamed keeps the default — a partial file is a patch, not a replacement.
    expect(params.priority).toEqual(DEFAULT_COGNITIVE_PARAMETERS.priority);
  });

  it('names the failure rather than silently replaying with defaults', () => {
    expect(readCognitiveParams('{ not json').errors[0]).toMatch(/not valid JSON/);
    expect(readCognitiveParams('[]').errors).toEqual(['expected a parameter object']);
  });

  it('rejects a value the live bounds would reject', () => {
    const { errors } = readCognitiveParams(
      JSON.stringify({ priority: { initialPriority: PARAMETER_SPACE.priority.initialPriority.max + 1 } })
    );

    expect(errors.some((e) => e.includes('initialPriority'))).toBe(true);
  });
});
