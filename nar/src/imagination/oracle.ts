import { Truth } from '../terms/truth.js';
import type { HiddenRule, OracleExpectation, ScenarioProfile } from './types.js';

export class HiddenModelOracle {
  private readonly hiddenRules: HiddenRule[];

  constructor(hiddenRules: HiddenRule[]) {
    this.hiddenRules = hiddenRules;
  }

  getHiddenRules(): HiddenRule[] {
    return [...this.hiddenRules];
  }

  getRule(term: string): HiddenRule | undefined {
    return this.hiddenRules.find((r) => r.term === term);
  }

  computeExpectations(profile: ScenarioProfile): OracleExpectation[] {
    switch (profile) {
      case 'induction':
        return this.computeInductionExpectations();
      case 'transitive':
        return this.computeTransitiveExpectations();
      case 'contradiction_storm':
        return this.computeContradictionExpectations();
      case 'overload':
        return this.computeOverloadExpectations();
      case 'drift':
        return this.computeDriftExpectations();
      case 'narrative':
        return this.computeNarrativeExpectations();
      default:
        return [];
    }
  }

  private computeInductionExpectations(): OracleExpectation[] {
    const rules = this.hiddenRules.filter((r) => r.term.includes('==>'));
    return rules.map((rule) => ({
      targetTerm: rule.term,
      expectedTruth: rule.truth,
      tolerance: { f: 0.1, c: 0.15 },
      stepsToConverge: 500,
      validator: 'induction_recovery',
    }));
  }

  private computeTransitiveExpectations(): OracleExpectation[] {
    const expectations: OracleExpectation[] = [];
    const inheritanceRules = this.hiddenRules.filter((r) => r.term.includes('-->'));

    for (const r1 of inheritanceRules) {
      for (const r2 of inheritanceRules) {
        const match1 = r1.term.match(/\((.+)\s*-->\s*(.+)\)/);
        const match2 = r2.term.match(/\((.+)\s*-->\s*(.+)\)/);
        if (!match1 || !match2) continue;
        const [, a, b] = match1;
        const [, c, d] = match2;
        if (b === c) {
          const transitiveTerm = `(${a} --> ${d})`;
          const composedTruth = Truth.deduction(r1.truth, r2.truth);
          expectations.push({
            targetTerm: transitiveTerm,
            expectedTruth: composedTruth,
            tolerance: { f: 0.1, c: 0.15 },
            stepsToConverge: 300,
            validator: 'transitive_derivation',
          });
        }
      }
    }
    return expectations;
  }

  private computeContradictionExpectations(): OracleExpectation[] {
    const contradictoryPairs = this.findContradictoryPairs();
    return contradictoryPairs.map((pair) => {
      const [r1, r2] = pair;
      return {
        targetTerm: `contradiction(${r1.term}, ${r2.term})`,
        expectedTruth: Truth.create(1.0, 0.9),
        tolerance: { f: 0.0, c: 0.1 },
        stepsToConverge: 10,
        validator: 'contradiction_detected',
      };
    });
  }

  private computeOverloadExpectations(): OracleExpectation[] {
    return [
      {
        targetTerm: 'quality_vs_load',
        expectedTruth: Truth.create(0.8, 0.7),
        tolerance: { f: 0.1, c: 0.2 },
        stepsToConverge: 400,
        validator: 'graceful_degradation',
      },
    ];
  }

  private computeDriftExpectations(): OracleExpectation[] {
    return [
      {
        targetTerm: 'retention_stale_vs_salient',
        expectedTruth: Truth.create(0.7, 0.8),
        tolerance: { f: 0.15, c: 0.2 },
        stepsToConverge: 500,
        validator: 'forgetting_retention',
      },
    ];
  }

  private computeNarrativeExpectations(): OracleExpectation[] {
    return this.hiddenRules.map((rule) => ({
      targetTerm: rule.term,
      expectedTruth: rule.truth,
      tolerance: { f: 0.2, c: 0.25 },
      stepsToConverge: 500,
      validator: 'narrative_grounding',
    }));
  }

  private findContradictoryPairs(): [HiddenRule, HiddenRule][] {
    const pairs: [HiddenRule, HiddenRule][] = [];
    for (let i = 0; i < this.hiddenRules.length; i++) {
      const r1 = this.hiddenRules[i];
      if (!r1) continue;
      for (let j = i + 1; j < this.hiddenRules.length; j++) {
        const r2 = this.hiddenRules[j];
        if (!r2) continue;
        if (this.areContradictory(r1, r2)) {
          pairs.push([r1, r2]);
        }
      }
    }
    return pairs;
  }

  private areContradictory(r1: HiddenRule, r2: HiddenRule): boolean {
    const t1 = this.parseTerm(r1.term);
    const t2 = this.parseTerm(r2.term);
    if (!t1 || !t2) return false;
    return t1.predicate === t2.predicate && t1.subject === t2.subject && t1.truth !== t2.truth;
  }

  private parseTerm(term: string): { subject: string; predicate: string; truth: Truth } | null {
    const match = term.match(/\((.+)\s*(==>|-->|<=>)\s*(.+)\)/);
    if (!match) return null;
    const subject = match[1]?.trim() ?? '';
    const predicate = match[3]?.trim() ?? '';
    return {
      subject,
      predicate,
      truth: Truth.create(0.5, 0.5),
    };
  }

  evaluateRecovery(derivedTruth: Truth, expectedTruth: Truth, tolerance: { f: number; c: number }): {
    passed: boolean;
    fError: number;
    cError: number;
  } {
    const fError = Math.abs(derivedTruth.f - expectedTruth.f);
    const cError = Math.abs(derivedTruth.c - expectedTruth.c);
    return {
      passed: fError <= tolerance.f && cError <= tolerance.c,
      fError,
      cError,
    };
  }

  computeOverloadKnee(degradationPoints: Array<{ multiplier: number; quality: number }>): number | null {
    for (let i = 1; i < degradationPoints.length; i++) {
      const prev = degradationPoints[i - 1];
      const curr = degradationPoints[i];
      if (!prev || !curr) continue;
      const qualityDrop = prev.quality - curr.quality;
      const multiplierIncrease = curr.multiplier - prev.multiplier;
      if (multiplierIncrease > 0 && qualityDrop / multiplierIncrease > 0.15 && curr.quality < 0.8) {
        return curr.multiplier;
      }
    }
    return null;
  }
}

export function createOracleFromScenario(profile: ScenarioProfile, seed: number): HiddenModelOracle {
  const hiddenRules = generateHiddenRules(profile, seed);
  return new HiddenModelOracle(hiddenRules);
}

function generateHiddenRules(profile: ScenarioProfile, seed: number): HiddenRule[] {
  const rng = mulberry32(seed);

  switch (profile) {
    case 'induction':
      return [
        { term: '(bell ==> rain). %1.0;0.95%', truth: Truth.create(1.0, 0.95) },
        { term: '(cloudy ==> rain). %0.7;0.8%', truth: Truth.create(0.7, 0.8) },
      ];
    case 'transitive':
      return [
        { term: '(A --> B). %1.0;0.9%', truth: Truth.create(1.0, 0.9) },
        { term: '(B --> C). %1.0;0.9%', truth: Truth.create(1.0, 0.9) },
      ];
    case 'contradiction_storm':
      return [
        { term: '(sensor_A --> sensor_B). %0.9;0.9%', truth: Truth.create(0.9, 0.9) },
        { term: '(sensor_B --> sensor_A). %0.1;0.9%', truth: Truth.create(0.1, 0.9) },
      ];
    case 'overload':
      return [
        { term: '(data --> pattern). %0.8;0.8%', truth: Truth.create(0.8, 0.8) },
      ];
    case 'drift':
      return [
        { term: '(stale --> forgotten). %0.2;0.5%', truth: Truth.create(0.2, 0.5) },
        { term: '(salient --> retained). %0.9;0.9%', truth: Truth.create(0.9, 0.9) },
      ];
    case 'narrative':
      return [
        { term: '(bell ==> rain). %0.8;0.7%', truth: Truth.create(0.8, 0.7) },
        { term: '(liar ==> false). %0.6;0.6%', truth: Truth.create(0.6, 0.6) },
      ];
    default:
      return [];
  }
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}