import { mean, safeRatio } from '@senars/util';
import { tool } from 'ai';
import { z } from 'zod';
import { parseVitestResult, type VitestResult } from './vitest-json.js';
import { runVitestJson } from './vitest-run.js';

// --- run_tests ---

export interface TestRunnerDeps {
  workspaceRoot?: string;
  episodicMemory?: any;
  rlfpLearner?: any;
}

export function createTestRunnerTools(deps: TestRunnerDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();

  return {
    run_tests: tool({
      description:
        'Run vitest tests in background and inject results into episodic memory. Returns test metrics for RLFP reward calculation.',
      inputSchema: z.strictObject({
        testPath: z.string().optional().describe('Specific test file or directory to run'),
        includeCoverage: z.boolean().optional().default(false).describe('Include coverage data'),
        injectEpisodes: z
          .boolean()
          .optional()
          .default(true)
          .describe('Inject test results as episodes'),
      }),
      execute: async ({ testPath, includeCoverage = false, injectEpisodes = true }) => {
        const run = await runVitestJson({
          workspaceRoot,
          testPath,
          coverage: includeCoverage,
        });
        const result: VitestResult | null = run.output ? parseVitestResult(run.output) : null;

        if (!result) {
          return {
            success: false,
            error: 'Failed to parse vitest output',
            stderr: run.stderr.slice(0, 1000),
          };
        }

        const exitCode = run.code;

        // Inject episodes if requested
        if (injectEpisodes && deps.episodicMemory) {
          try {
            const _timestamp = Date.now();

            // Inject overall test result
            await deps.episodicMemory.log(
              result.success ? 'test_passed' : 'test_failed',
              `Test suite ${result.success ? 'passed' : 'failed'}: ${result.passed}/${result.total} tests`,
              {
                type: 'test_suite_result',
                passed: result.passed,
                failed: result.failed,
                total: result.total,
                duration: result.duration,
                coverage: result.coverage,
                exitCode,
              }
            );

            // Inject individual test results
            for (const test of result.tests) {
              await deps.episodicMemory.log(
                test.state === 'pass' ? 'test_passed' : 'test_failed',
                `Test ${test.name} ${test.state}`,
                {
                  type: 'test_result',
                  testName: test.name,
                  state: test.state,
                  duration: test.duration,
                  errors: test.errors,
                }
              );

              // If test failed, inject a goal to fix it
              if (test.state === 'fail' && test.errors) {
                await deps.episodicMemory.log('goal', `(^fixTest("${test.name}"))!`, {
                  type: 'fix_test_goal',
                  testName: test.name,
                  errors: test.errors,
                });
              }
            }

            // Inject coverage info if available
            if (result.coverage && includeCoverage) {
              await deps.episodicMemory.log(
                'test_coverage',
                `Coverage: lines ${result.coverage.lines.pct.toFixed(1)}%, statements ${result.coverage.statements.pct.toFixed(1)}%`,
                {
                  type: 'coverage_report',
                  coverage: result.coverage,
                }
              );
            }
          } catch (error) {
            console.warn('Failed to inject test episodes:', error);
          }
        }

        // Calculate RLFP reward if learner available
        let reward = 0;
        if (deps.rlfpLearner && result) {
          const coverageDelta = result.coverage
            ? result.coverage.lines.pct / 100 - 0.5 // baseline 50%
            : 0;
          reward = deps.rlfpLearner.calculateReward({
            passRate: safeRatio(result.passed, result.total),
            avgTestDuration: result.tests.length > 0 ? mean(result.tests, (v) => v.duration) : 0,
            coverageDelta,
            memoryOverage: 0,
            cpuThrottleTime: 0,
          });
        }

        return {
          success: result.success,
          passed: result.passed,
          failed: result.failed,
          total: result.total,
          duration: result.duration,
          coverage: result.coverage,
          reward,
          episodesInjected: injectEpisodes && !!deps.episodicMemory,
        };
      },
    }),
  };
}
