import { tool } from 'ai';
import { z } from 'zod';

// --- generate_scenarios ---

import {
  calculateScenarioReward,
  generateScenarioSpec,
  runScenario,
  type ScenarioGenDeps,
  type ScenarioResult,
  type ScenarioSpec,
  scenarioLogger,
  validators,
} from './scenario-execute.js';

export type {
  ScenarioGenDeps,
  ScenarioInjectEvent,
  ScenarioResult,
  ScenarioSpec,
  ScenarioSuccessCriteria,
} from './scenario-execute.js';

export function createScenarioGenTools(deps: ScenarioGenDeps = {}) {
  const _workspaceRoot = deps.workspaceRoot || process.cwd();

  return {
    generate_scenarios: tool({
      description:
        'Generate and execute cognitive scenarios using NL→Narsese→MeTTa pipeline. Tests integrated reasoning under realistic conditions.',
      inputSchema: z.object({
        seed: z
          .string()
          .describe('High-level intent for scenario (e.g., "contradictory sensors under load")'),
        profile: z
          .enum([
            'contradictory_sensors',
            'temporal_reasoning',
            'resource_pressure',
            'belief_revision',
            'cross_engine_sync',
            'auto',
          ])
          .optional()
          .default('auto')
          .describe('Scenario profile/template to use'),
        count: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(1)
          .describe('Number of scenarios to generate and run'),
        injectEpisodes: z
          .boolean()
          .optional()
          .default(true)
          .describe('Inject results into episodic memory'),
      }),
      execute: async ({ seed, profile, count = 1, injectEpisodes = true }) => {
        const results: ScenarioResult[] = [];
        const specs: ScenarioSpec[] = [];

        for (let i = 0; i < count; i++) {
          const scenarioSeed = count > 1 ? `${seed} (${i + 1}/${count})` : seed;
          const selectedProfile = profile === 'auto' ? inferProfile(scenarioSeed) : profile;

          const spec = await generateScenarioSpec(scenarioSeed, selectedProfile, deps.registry);
          specs.push(spec);

          if (deps.nar) {
            const result = await runScenario(deps.nar, spec);
            const reward = calculateScenarioReward(result, spec);

            result.criteria_results = validators.reduce(
              (acc, v) => {
                const validation = v.validate(result, spec);
                acc[v.name] = validation.passed;
                return acc;
              },
              {} as Record<string, boolean>
            );

            if (injectEpisodes && deps.episodicMemory) {
              await injectScenarioEpisodes(deps.episodicMemory, result, spec, reward);
            }

            if (deps.rlfpLearner) {
              deps.rlfpLearner.reward(reward, `scenario:${spec.name}`);
            }

            results.push(result);
          } else {
            results.push({
              success: true,
              scenario_name: spec.name,
              steps_executed: 0,
              duration_ms: 0,
              criteria_results: {},
              cognitive_events: 0,
              contradictions_detected: 0,
              derived_beliefs: [],
              error: 'NAR instance not provided - scenario spec generated only',
            });
          }
        }

        return {
          success: true,
          seed,
          profile,
          scenarios_generated: specs.length,
          scenarios_executed: results.filter((r) => r.steps_executed > 0).length,
          specs,
          results,
          summary: {
            passed: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            avg_reward:
              results.reduce((sum, r, idx) => sum + calculateScenarioReward(r, specs[idx]!), 0) /
              Math.max(results.length, 1),
          },
        };
      },
    }),
  };
}

function inferProfile(seed: string): string {
  const lower = seed.toLowerCase();
  if (lower.includes('contradict') || lower.includes('conflict') || lower.includes('sensor')) {
    return 'contradictory_sensors';
  }
  if (lower.includes('temporal') || lower.includes('sequence') || lower.includes('event')) {
    return 'temporal_reasoning';
  }
  if (
    lower.includes('load') ||
    lower.includes('pressure') ||
    lower.includes('overload') ||
    lower.includes('resource')
  ) {
    return 'resource_pressure';
  }
  if (lower.includes('revision') || lower.includes('belief') || lower.includes('evidence')) {
    return 'belief_revision';
  }
  if (
    lower.includes('cross') ||
    lower.includes('sync') ||
    lower.includes('metta') ||
    lower.includes('engine')
  ) {
    return 'cross_engine_sync';
  }
  return 'contradictory_sensors';
}

async function injectScenarioEpisodes(
  episodicMemory: any,
  result: ScenarioResult,
  spec: ScenarioSpec,
  reward: number
): Promise<void> {
  try {
    await episodicMemory.log(
      result.success ? 'scenario_passed' : 'scenario_failed',
      `Scenario ${spec.name} ${result.success ? 'passed' : 'failed'}`,
      {
        type: 'scenario_result',
        scenario: spec.name,
        profile: spec.metadata.profile,
        success: result.success,
        steps: result.steps_executed,
        duration_ms: result.duration_ms,
        contradictions: result.contradictions_detected,
        events: result.cognitive_events,
        derivations: result.derived_beliefs.length,
        reward,
        criteria: result.criteria_results,
      }
    );

    if (!result.success) {
      await episodicMemory.log('goal', `(^fixScenario("${spec.name}"))!`, {
        type: 'fix_scenario_goal',
        scenario: spec.name,
        errors: [result.error ?? 'Unknown failure'],
      });
    }
  } catch (error: unknown) {
    scenarioLogger.warn('Failed to inject scenario episodes', { error: String(error) });
  }
}
