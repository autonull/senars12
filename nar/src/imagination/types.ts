import type { Truth } from '../terms/truth.js';
import type { Task } from '../types/core.js';

export interface HiddenRule {
  term: string;
  truth: Truth;
}

export type ScenarioProfile =
  | 'induction'
  | 'transitive'
  | 'contradiction_storm'
  | 'overload'
  | 'drift'
  | 'narrative';

export interface OracleExpectation {
  targetTerm: string;
  expectedTruth: Truth;
  tolerance: { f: number; c: number };
  stepsToConverge: number;
  validator: string;
}

export interface Scenario {
  seed: number;
  profile: ScenarioProfile;
  hiddenModel: HiddenRule[];
  events: Task[];
  oracle: OracleExpectation[];
}

export interface GeneratorConfig {
  seed?: number;
  profile?: ScenarioProfile;
  hiddenModel?: HiddenRule[];
  eventCount?: number;
  noiseLevel?: number;
}

export interface TreadmillConfig {
  rate: number;
  burstProbability: number;
  burstSize: number;
  maxSteps: number;
  mixedEventRatio: { belief: number; goal: number; question: number };
}

export interface StressMetrics {
  throughput: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  contradictionRate: number;
  priorityOscillation: number;
  memoryPressure: number;
  derivationQuality: number;
  capacityKnee: number;
}

export interface DegradationPoint {
  multiplier: number;
  quality: number;
  latency: number;
  isKnee: boolean;
}

export interface DegradationCurve {
  points: DegradationPoint[];
  kneePoint: DegradationPoint | null;
}

export interface ArchitectureGap {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trigger: string;
  proposedFix: string;
  confidence: number;
  narseseBelief: string;
  narseseGoal: string;
}