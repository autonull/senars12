/**
 * Surprise Detection — identifies unexpected events for learning.
 *
 * Surprise events trigger curriculum updates and repertoire changes.
 */

import type { Term } from '../kernel/terms';
import type { TruthValue } from '../kernel/truth';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';

/** Surprise type. */
export const SURPRISE_TYPES = [
  'prediction_error',
  'novelty',
  'contradiction',
  'expectation_violation',
  'pattern_break',
] as const;

export type SurpriseType = (typeof SURPRISE_TYPES)[number];

/** Surprise event. */
export interface SurpriseEvent {
  /** Event ID. */
  id: string;
  /** Surprise type. */
  type: SurpriseType;
  /** Term involved. */
  term: Term;
  /** Expected truth. */
  expected: TruthValue;
  /** Actual truth. */
  actual: TruthValue;
  /** Surprise magnitude [0, 1]. */
  magnitude: number;
  /** Timestamp. */
  timestamp: number;
  /** Context. */
  context: Record<string, unknown>;
  /** Source. */
  source: 'perception' | 'derivation' | 'oracle' | 'external';
}

/** Surprise detector config. */
export interface SurpriseConfig {
  /** Prediction error threshold. */
  predictionErrorThreshold: number;
  /** Novelty threshold. */
  noveltyThreshold: number;
  /** Contradiction threshold. */
  contradictionThreshold: number;
  /** Expectation violation threshold. */
  expectationViolationThreshold: number;
  /** Pattern break window. */
  patternBreakWindow: number;
  /** Decay rate for expectations. */
  expectationDecay: number;
}

/** Default surprise config. */
export const defaultSurpriseConfig: SurpriseConfig = {
  predictionErrorThreshold: 0.3,
  noveltyThreshold: 0.8,
  contradictionThreshold: 0.7,
  expectationViolationThreshold: 0.4,
  patternBreakWindow: 10,
  expectationDecay: 0.99,
};

/** Expectation tracker. */
export interface ExpectationTracker {
  /** Expected truth per term. */
  expectations: Map<string, TruthValue>;
  /** Confidence in expectation. */
  confidence: Map<string, number>;
  /** History per term. */
  history: Map<string, TruthValue[]>;
  /** Last updated. */
  lastUpdated: Map<string, number>;
}

/** Surprise detector. */
export class SurpriseDetector {
  private config: SurpriseConfig;
  private tracker: ExpectationTracker;
  private clock: Clock;
  private rng: RNG;

  constructor(config: SurpriseConfig = defaultSurpriseConfig, clock?: Clock, rng?: RNG) {
    this.config = config;
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
    this.tracker = {
      expectations: new Map(),
      confidence: new Map(),
      history: new Map(),
      lastUpdated: new Map(),
    };
  }

  /** Process a new observation. */
  processObservation(
    term: Term,
    truth: TruthValue,
    source: SurpriseEvent['source'] = 'perception',
    context: Record<string, unknown> = {}
  ): SurpriseEvent[] {
    const surprises: SurpriseEvent[] = [];
    const termKey = JSON.stringify(term);

    // Get or create expectation
    let expected = this.tracker.expectations.get(termKey);
    let confidence = this.tracker.confidence.get(termKey) ?? 0;

    if (expected) {
      // Check prediction error
      const freqError = Math.abs(expected.f - truth.f);
      const confError = Math.abs(expected.c - truth.c);
      const maxError = Math.max(freqError, confError);

      if (maxError > this.config.predictionErrorThreshold) {
        surprises.push(this.createSurprise(
          'prediction_error',
          term,
          expected,
          truth,
          maxError,
          source,
          context
        ));
      }

      // Check contradiction (opposite frequency)
      if (Math.abs(expected.f - (1 - truth.f)) < this.config.contradictionThreshold) {
        surprises.push(this.createSurprise(
          'contradiction',
          term,
          expected,
          truth,
          this.config.contradictionThreshold,
          source,
          context
        ));
      }

      // Check expectation violation
      const violation = this.computeExpectationViolation(expected, truth);
      if (violation > this.config.expectationViolationThreshold) {
        surprises.push(this.createSurprise(
          'expectation_violation',
          term,
          expected,
          truth,
          violation,
          source,
          context
        ));
      }
    } else {
      // Novel term - check novelty
      if (this.isNovel(termKey)) {
        surprises.push(this.createSurprise(
          'novelty',
          term,
          { f: 0, c: 0 },
          truth,
          this.config.noveltyThreshold,
          source,
          context
        ));
      }
    }

    // Update expectation
    this.updateExpectation(termKey, truth);

    // Check pattern break
    const patternBreak = this.checkPatternBreak(termKey, truth);
    if (patternBreak) {
      surprises.push(patternBreak);
    }

    return surprises;
  }

  /** Create surprise event. */
  private createSurprise(
    type: SurpriseType,
    term: Term,
    expected: TruthValue,
    actual: TruthValue,
    magnitude: number,
    source: SurpriseEvent['source'],
    context: Record<string, unknown>
  ): SurpriseEvent {
    const now = this.clock.now();
    return {
      id: `surprise-${now}-${this.rng.next().toString(36).slice(2, 8)}`,
      type,
      term,
      expected,
      actual,
      magnitude: Math.min(1, magnitude),
      timestamp: now,
      context,
      source,
    };
  }

  /** Check if term is novel. */
  private isNovel(termKey: string): boolean {
    return !this.tracker.expectations.has(termKey);
  }

  /** Compute expectation violation. */
  private computeExpectationViolation(expected: TruthValue, actual: TruthValue): number {
    // Weighted combination of frequency and confidence difference
    const freqDiff = Math.abs(expected.f - actual.f);
    const confDiff = Math.abs(expected.c - actual.c);
    return (freqDiff * expected.c + confDiff * expected.f) / (expected.c + expected.f || 1);
  }

  /** Update expectation with new observation. */
  private updateExpectation(termKey: string, truth: TruthValue): void {
    const now = this.clock.now();
    const history = this.tracker.history.get(termKey) ?? [];
    history.push(truth);
    if (history.length > 100) history.shift();
    this.tracker.history.set(termKey, history);

    // Exponential moving average
    const prev = this.tracker.expectations.get(termKey);
    const decay = this.config.expectationDecay;
    if (prev) {
      this.tracker.expectations.set(termKey, {
        f: prev.f * decay + truth.f * (1 - decay),
        c: prev.c * decay + truth.c * (1 - decay),
      });
    } else {
      this.tracker.expectations.set(termKey, { ...truth });
    }

    // Update confidence based on history consistency
    const conf = this.computeConfidence(history);
    this.tracker.confidence.set(termKey, conf);
    this.tracker.lastUpdated.set(termKey, now);
  }

  /** Compute confidence from history. */
  private computeConfidence(history: TruthValue[]): number {
    if (history.length < 2) return 0.5;

    const freqVariance = this.variance(history.map(h => h.f));
    const confVariance = this.variance(history.map(h => h.c));
    const avgVariance = (freqVariance + confVariance) / 2;

    // Lower variance = higher confidence
    return Math.max(0, Math.min(1, 1 - avgVariance * 4));
  }

  /** Compute variance. */
  private variance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  }

  /** Check for pattern break. */
  private checkPatternBreak(termKey: string, truth: TruthValue): SurpriseEvent | null {
    const history = this.tracker.history.get(termKey);
    if (!history || history.length < this.config.patternBreakWindow) {
      return null;
    }

    const recent = history.slice(-this.config.patternBreakWindow);
    const older = history.slice(-this.config.patternBreakWindow * 2, -this.config.patternBreakWindow);

    if (older.length === 0) return null;

    const recentAvg = {
      f: recent.reduce((a, b) => a + b.f, 0) / recent.length,
      c: recent.reduce((a, b) => a + b.c, 0) / recent.length,
    };
    const olderAvg = {
      f: older.reduce((a, b) => a + b.f, 0) / older.length,
      c: older.reduce((a, b) => a + b.c, 0) / older.length,
    };

    const freqShift = Math.abs(recentAvg.f - olderAvg.f);
    const confShift = Math.abs(recentAvg.c - olderAvg.c);

    if (freqShift > 0.5 || confShift > 0.5) {
      return this.createSurprise(
        'pattern_break',
        { op: 'CONSTANT' as any, value: termKey } as Term,
        olderAvg,
        recentAvg,
        Math.max(freqShift, confShift),
        'derivation',
        { window: this.config.patternBreakWindow }
      );
    }

    return null;
  }

  /** Get current expectation for term. */
  getExpectation(term: Term): TruthValue | undefined {
    return this.tracker.expectations.get(JSON.stringify(term));
  }

  /** Get expectation confidence. */
  getConfidence(term: Term): number {
    return this.tracker.confidence.get(JSON.stringify(term)) ?? 0;
  }

  /** Reset tracker. */
  reset(): void {
    this.tracker = {
      expectations: new Map(),
      confidence: new Map(),
      history: new Map(),
      lastUpdated: new Map(),
    };
  }
}

/** Create a surprise detector. */
export function createSurpriseDetector(config?: SurpriseConfig, clock?: Clock, rng?: RNG): SurpriseDetector {
  return new SurpriseDetector(config, clock, rng);
}