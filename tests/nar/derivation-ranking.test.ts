import { describe, expect, it } from 'vitest';
import { rankDerivations, scoreDerivation, DEFAULT_MAX_ADMISSIONS, DEFAULT_MIN_SCORE } from '../../nar/src/rules/ranking.js';
import { DEFAULT_COGNITIVE_PARAMETERS, PARAMETER_SPACE, mergeParameters } from '../../nar/src/config/cognitive-parameters.js';

const t = (s: string, f?: number, c?: number) => ({ term: { toString: () => s }, ...(f !== undefined && c !== undefined ? { truth: { f, c } } : {}) });

describe('todo7: derivation ranking', () => {
  it('decisive high-confidence first; zero-information tautology dropped', () => {
    const out = rankDerivations([t('(a --> b)', 0.5, 0.9), t('(c --> d)', 0.9, 0.9), t('(e --> f)', 0.1, 0.8)]);
    expect(out.map((r) => r.term.toString())).toEqual(['(c --> d)', '(e --> f)']);
  });
  it('giant terms penalized; low confidence sinks', () => {
    expect(scoreDerivation('x'.repeat(5000), 1, 1)).toBeLessThan(scoreDerivation('(a --> b)', 1, 1));
    const out = rankDerivations([t('(a --> b)', 1, 0.1), t('(c --> d)', 0.8, 0.9)]);
    expect(out[0]?.term.toString()).toBe('(c --> d)');
  });
  it('ranking tunable via CognitiveParameters + PARAMETER_SPACE', () => {
    expect(DEFAULT_COGNITIVE_PARAMETERS.inference.ranking).toEqual({ maxAdmissions: DEFAULT_MAX_ADMISSIONS, minScore: DEFAULT_MIN_SCORE });
    expect(PARAMETER_SPACE.inference.rankingMaxAdmissions.default).toBe(100);
    const merged = mergeParameters({ inference: { ...DEFAULT_COGNITIVE_PARAMETERS.inference, ranking: { maxAdmissions: 5, minScore: 0.5 } } });
    const many = Array.from({ length: 10 }, (_, i) => t(`(t${i} --> u)`, 0.9, 0.9));
    expect(rankDerivations(many, merged.inference.ranking)).toHaveLength(5);
  });
  it('maxAdmissions caps; minScore floors; truthless dropped', () => {
    const many = Array.from({ length: 10 }, (_, i) => t(`(t${i} --> u)`, 0.9, 0.9));
    expect(rankDerivations([...many, t('(no-truth)')], { maxAdmissions: 3 })).toHaveLength(3);
    expect(rankDerivations([t('(a --> b)', 0.9, 0.9)], { minScore: 0.95 })).toHaveLength(0);
  });
});
