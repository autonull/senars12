import type { SeNARSRegistry } from '../../lm';
import { createLogger } from '../../logger';
import { NLUnderstandingService } from '../../nl/understanding.js';

// --- generate_scenarios ---

export const scenarioLogger = createLogger({ scope: 'ScenarioGen' });

export interface ScenarioInjectEvent {
  type: 'belief_stream' | 'question' | 'resource_pressure' | 'goal';
  pattern?: string;
  interval?: number;
  maxDerivationsPerStep?: number;
  narsese?: string;
  truth?: { f: number; c: number };
  priority?: number;
}

export interface ScenarioSuccessCriteria {
  no_crash?: boolean;
  contradiction_detected_within?: number;
  response_latency_p95?: number;
  min_derivations?: number;
  specific_belief_derived?: string;
}

export interface ScenarioSpec {
  name: string;
  description: string;
  duration_steps: number;
  inject: ScenarioInjectEvent[];
  success_criteria: ScenarioSuccessCriteria;
  metadata: {
    seed: string;
    generated_at: string;
    profile: string;
  };
}

export interface ScenarioResult {
  success: boolean;
  scenario_name: string;
  steps_executed: number;
  duration_ms: number;
  criteria_results: Record<string, boolean | number>;
  cognitive_events: number;
  contradictions_detected: number;
  derived_beliefs: string[];
  error?: string;
}

export interface ScenarioRunnerDeps {
  workspaceRoot?: string;
  nar?: any; // NAR instance
  episodicMemory?: any;
  rlfpLearner?: any;
  registry?: SeNARSRegistry;
}

interface ScenarioValidator {
  name: string;

  validate(
    result: ScenarioResult,
    spec: ScenarioSpec
  ): { passed: boolean; score: number; details: string };
}

export const validators: ScenarioValidator[] = [
  {
    name: 'no_crash',
    validate(result: ScenarioResult, _spec: ScenarioSpec) {
      return {
        passed: result.success,
        score: result.success ? 1.0 : 0.0,
        details: result.success ? 'No crash' : `Crashed: ${result.error}`,
      };
    },
  },
  {
    name: 'contradiction_detected',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.contradiction_detected_within ?? 10;
      const passed = result.contradictions_detected > 0 && result.steps_executed <= threshold;
      return {
        passed,
        score: passed ? 1.0 : 0.5,
        details: passed
          ? `Contradiction detected at step ${result.steps_executed}`
          : `No contradiction within ${threshold} steps`,
      };
    },
  },
  {
    name: 'latency_p95',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.response_latency_p95 ?? 100;
      const avgLatency = result.duration_ms / Math.max(result.steps_executed, 1);
      const passed = avgLatency <= threshold;
      return {
        passed,
        score: passed ? 1.0 : Math.max(0, 1 - avgLatency / (threshold * 2)),
        details: `Avg latency ${avgLatency.toFixed(1)}ms (threshold: ${threshold}ms)`,
      };
    },
  },
  {
    name: 'min_derivations',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.min_derivations ?? 1;
      const passed = result.derived_beliefs.length >= threshold;
      return {
        passed,
        score: passed ? 1.0 : result.derived_beliefs.length / threshold,
        details: `${result.derived_beliefs.length}/${threshold} derivations`,
      };
    },
  },
  {
    name: 'specific_belief',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const target = spec.success_criteria.specific_belief_derived;
      if (!target) return { passed: true, score: 1.0, details: 'No specific belief required' };
      const passed = result.derived_beliefs.some((b) => b.includes(target));
      return {
        passed,
        score: passed ? 1.0 : 0.0,
        details: passed ? `Derived ${target}` : `Missing ${target}`,
      };
    },
  },
];

export function calculateScenarioReward(result: ScenarioResult, spec: ScenarioSpec): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const validator of validators) {
    const weight = spec.success_criteria[validator.name as keyof ScenarioSuccessCriteria] ? 1 : 0;
    if (weight === 0) continue;
    const validation = validator.validate(result, spec);
    totalScore += validation.score * weight;
    totalWeight += weight;
  }

  const baseReward = totalWeight > 0 ? totalScore / totalWeight : 0;
  const stepBonus = Math.min(1, result.steps_executed / spec.duration_steps) * 0.2;
  const eventBonus = Math.min(1, result.cognitive_events / 100) * 0.1;

  return Math.min(1, baseReward + stepBonus + eventBonus);
}

export async function generateScenarioSpec(
  seed: string,
  profile: string,
  registry?: SeNARSRegistry
): Promise<ScenarioSpec> {
  if (!registry) {
    return generateTemplateScenario(seed, profile);
  }

  try {
    // @ts-expect-error - TranslationCache interface mismatch
    const understanding = new NLUnderstandingService(registry, new Map(), { structuredOnly: true });
    const nlInput = `Generate a cognitive test scenario for SeNARS. Profile: ${profile}. Seed: "${seed}". 
    Output a JSON spec with: name, description, duration_steps, inject (array of events with type, pattern, interval), success_criteria.
    Events can be: belief_stream (pattern, interval), question (pattern, interval), resource_pressure (maxDerivationsPerStep), goal (narsese, priority).
    Success criteria: no_crash, contradiction_detected_within, response_latency_p95, min_derivations, specific_belief_derived.`;

    const taskBatch = await understanding.understand(nlInput);
    if (taskBatch && taskBatch.goals.length > 0) {
      const goalContent = taskBatch.goals[0]?.narsese;
      if (!goalContent) return generateTemplateScenario(seed, profile);
      try {
        const parsed = JSON.parse(goalContent.replace(/^!/, '').trim());
        return {
          ...parsed,
          metadata: { seed, generated_at: new Date().toISOString(), profile },
        } as ScenarioSpec;
      } catch {
        scenarioLogger.warn('Failed to parse NL-generated scenario, using template');
      }
    }
  } catch (error: unknown) {
    scenarioLogger.warn('NL scenario generation failed, using template', { error: String(error) });
  }

  return generateTemplateScenario(seed, profile);
}

function generateTemplateScenario(seed: string, profile: string): ScenarioSpec {
  const profiles: Record<string, Partial<ScenarioSpec>> = {
    contradictory_sensors: {
      name: 'contradictory_sensors',
      description: 'Test handling of contradictory sensor inputs',
      duration_steps: 500,
      inject: [
        { type: 'belief_stream', pattern: '(sensor_A --> sensor_B). %0.9;0.9%', interval: 5 },
        { type: 'belief_stream', pattern: '(sensor_B --> sensor_A). %0.1;0.9%', interval: 5 },
        { type: 'question', pattern: '(sensor_A --> ?what)?', interval: 20 },
        { type: 'resource_pressure', maxDerivationsPerStep: 50 },
      ],
      success_criteria: {
        no_crash: true,
        contradiction_detected_within: 10,
        response_latency_p95: 100,
        min_derivations: 5,
      },
    },
    temporal_reasoning: {
      name: 'temporal_reasoning',
      description: 'Test event sequences with delayed evidence',
      duration_steps: 300,
      inject: [
        {
          type: 'belief_stream',
          pattern: '(event_A * event_B * event_C). %0.8;0.8%',
          interval: 10,
        },
        { type: 'question', pattern: '(event_A ==> event_C)?', interval: 30 },
        { type: 'resource_pressure', maxDerivationsPerStep: 100 },
      ],
      success_criteria: {
        no_crash: true,
        min_derivations: 3,
        specific_belief_derived: 'event_A ==> event_C',
      },
    },
    resource_pressure: {
      name: 'resource_pressure',
      description: 'Test AIKR graceful degradation under load',
      duration_steps: 400,
      inject: [
        { type: 'belief_stream', pattern: '(data --> pattern). %0.7;0.7%', interval: 2 },
        { type: 'resource_pressure', maxDerivationsPerStep: 20 },
        { type: 'question', pattern: '(data --> ?what)?', interval: 15 },
      ],
      success_criteria: {
        no_crash: true,
        response_latency_p95: 50,
        min_derivations: 10,
      },
    },
    belief_revision: {
      name: 'belief_revision',
      description: 'Test belief revision with incoming evidence streams',
      duration_steps: 350,
      inject: [
        { type: 'belief_stream', pattern: '(hypothesis --> confirmed). %0.6;0.6%', interval: 8 },
        { type: 'belief_stream', pattern: '(hypothesis --> refuted). %0.9;0.8%', interval: 20 },
        { type: 'question', pattern: '(hypothesis --> ?what)?', interval: 25 },
      ],
      success_criteria: {
        no_crash: true,
        contradiction_detected_within: 15,
        min_derivations: 5,
      },
    },
    cross_engine_sync: {
      name: 'cross_engine_sync',
      description: 'Test NAR-MeTTa coordination',
      duration_steps: 250,
      inject: [
        { type: 'belief_stream', pattern: '(nar_fact <-> metta_atom). %0.8;0.8%', interval: 10 },
        { type: 'goal', narsese: '(^sync(nar_fact, metta_atom))!', priority: 0.7 },
        { type: 'question', pattern: '(nar_fact <-> ?what)?', interval: 20 },
      ],
      success_criteria: {
        no_crash: true,
        min_derivations: 3,
        specific_belief_derived: 'nar_fact <-> metta_atom',
      },
    },
  };

  const profileSpec = profiles[profile] ?? profiles.contradictory_sensors!;

  return {
    name: profileSpec.name ?? profile,
    description: profileSpec.description ?? `Scenario for ${seed}`,
    duration_steps: profileSpec.duration_steps ?? 300,
    inject: profileSpec.inject ?? [],
    success_criteria: profileSpec.success_criteria ?? { no_crash: true },
    metadata: { seed, generated_at: new Date().toISOString(), profile },
  };
}

export async function runScenario(nar: any, spec: ScenarioSpec): Promise<ScenarioResult> {
  const startTime = Date.now();
  let cognitiveEvents = 0;
  let contradictionsDetected = 0;
  const derivedBeliefs: string[] = [];

  const eventHandler = (event: any) => {
    cognitiveEvents++;
    if (event.type === 'conflict:detected' || event.type === 'belief.revised') {
      contradictionsDetected++;
    }
    if (event.type === 'belief.added' || event.type === 'belief.revised') {
      derivedBeliefs.push(event.payload.term);
    }
  };

  if (nar.getSystemEventBus) {
    nar.getSystemEventBus().on('*', eventHandler);
  }

  try {
    for (const injectEvent of spec.inject) {
      switch (injectEvent.type) {
        case 'belief_stream':
          if (injectEvent.pattern) {
            await nar.believe(injectEvent.pattern);
          }
          break;
        case 'question':
          if (injectEvent.pattern) {
            await nar.question(injectEvent.pattern);
          }
          break;
        case 'goal':
          if (injectEvent.narsese) {
            await nar.goal(
              injectEvent.narsese,
              injectEvent.priority
                ? {
                    f: injectEvent.priority,
                    c: 0.9,
                  }
                : undefined
            );
          }
          break;
        case 'resource_pressure':
          if (injectEvent.maxDerivationsPerStep && nar.setConfig) {
            nar.setConfig({
              inference: {
                ...nar.getConfig().inference,
                maxDerivationsPerStep: injectEvent.maxDerivationsPerStep,
              },
            });
          }
          break;
      }
    }

    const stepsToRun = spec.duration_steps;
    await nar.run(stepsToRun);

    const duration = Date.now() - startTime;

    return {
      success: true,
      scenario_name: spec.name,
      steps_executed: stepsToRun,
      duration_ms: duration,
      criteria_results: {},
      cognitive_events: cognitiveEvents,
      contradictions_detected: contradictionsDetected,
      derived_beliefs: derivedBeliefs,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      scenario_name: spec.name,
      steps_executed: 0,
      duration_ms: duration,
      criteria_results: {},
      cognitive_events: cognitiveEvents,
      contradictions_detected: contradictionsDetected,
      derived_beliefs: derivedBeliefs,
      error: String(error),
    };
  } finally {
    if (nar.getSystemEventBus) {
      nar.getSystemEventBus().off('*', eventHandler);
    }
  }
}

export interface ScenarioGenDeps {
  workspaceRoot?: string;
  nar?: any;
  episodicMemory?: any;
  rlfpLearner?: any;
  registry?: SeNARSRegistry;
}
