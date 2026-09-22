import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

// --- run_tests ---

export interface TestRunnerDeps {
  workspaceRoot?: string;
  episodicMemory?: any;
  rlfpLearner?: any;
}

interface VitestResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: Array<{
    name: string;
    state: 'pass' | 'fail' | 'skip';
    duration: number;
    errors?: string[];
  }>;
  coverage?: {
    lines: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
}

function parseVitestJsonOutput(output: string): VitestResult | null {
  try {
    // Find the JSON part (vitest outputs JSON on stdout, but may have other messages)
    const lines = output.trim().split('\n');
    // Look for the line that starts with { (JSON object)
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line?.trim().startsWith('{')) {
        jsonStart = i;
        break;
      }
    }
    if (jsonStart === -1) return null;
    const jsonStr = lines.slice(jsonStart).join('\n');
    const data = JSON.parse(jsonStr);

    // Calculate duration from test results
    let duration = 0;
    if (data.testResults) {
      for (const suite of data.testResults) {
        duration += (suite.endTime ?? 0) - (suite.startTime ?? 0);
      }
    }

    // Parse coverage from coverageMap
    let coverage: VitestResult['coverage'];
    if (data.coverageMap) {
      let totalLines = 0;
      let coveredLines = 0;
      let totalStatements = 0;
      let coveredStatements = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let totalBranches = 0;
      let coveredBranches = 0;

      for (const file of Object.values(data.coverageMap)) {
        const fileCoverage = file as any;
        // Lines (l) - may not exist in all formats
        if (fileCoverage.l) {
          for (const [, count] of Object.entries(fileCoverage.l)) {
            totalLines++;
            if ((count as number) > 0) coveredLines++;
          }
        }
        // Statements (s)
        if (fileCoverage.s) {
          for (const [, count] of Object.entries(fileCoverage.s)) {
            totalStatements++;
            if ((count as number) > 0) coveredStatements++;
          }
        }
        // Functions (f)
        if (fileCoverage.f) {
          for (const [, count] of Object.entries(fileCoverage.f)) {
            totalFunctions++;
            if ((count as number) > 0) coveredFunctions++;
          }
        }
        // Branches (b)
        if (fileCoverage.b) {
          for (const [, count] of Object.entries(fileCoverage.b)) {
            totalBranches++;
            if ((count as number) > 0) coveredBranches++;
          }
        }
      }

      // Use statements as lines if lines not available
      const linesTotal = totalLines > 0 ? totalLines : totalStatements;
      const linesCovered = totalLines > 0 ? coveredLines : coveredStatements;

      coverage = {
        lines: {
          total: linesTotal,
          covered: linesCovered,
          pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0,
        },
        statements: {
          total: totalStatements,
          covered: coveredStatements,
          pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        },
      };
    }

    return {
      success: data.success,
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      total: data.numTotalTests ?? 0,
      duration,
      tests:
        data.testResults?.flatMap(
          (suite: any) =>
            suite.assertionResults?.map((t: any) => ({
              name: t.fullName,
              state: t.status === 'passed' ? 'pass' : t.status === 'failed' ? 'fail' : 'skip',
              duration: t.duration,
              errors: t.failureMessages,
            })) ?? []
        ) ?? [],
      coverage,
    };
  } catch {
    return null;
  }
}

export function createTestRunnerTools(deps: TestRunnerDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const outputFile = resolve(workspaceRoot, '.vitest/json/output.json');

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
        const args = ['run', '--reporter=json'];
        if (includeCoverage) args.push('--coverage');
        if (testPath) args.push(testPath);

        return new Promise((resolve) => {
          const child = spawn('pnpm', ['vitest', ...args], {
            cwd: workspaceRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stderr = '';

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', async (exitCode) => {
            // Read the JSON output file
            let result: VitestResult | null = null;
            try {
              const { readFile } = await import('node:fs/promises');
              const outputContent = await readFile(outputFile, 'utf-8');
              result = parseVitestJsonOutput(outputContent);
            } catch {
              // File doesn't exist or can't be read
            }

            if (!result) {
              resolve({
                success: false,
                error: 'Failed to parse vitest output',
                stderr: stderr.slice(0, 1000),
              });
              return;
            }

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
                testPassRate: result.total > 0 ? result.passed / result.total : 0,
                avgTestDuration:
                  result.tests.length > 0
                    ? result.tests.reduce((sum, t) => sum + t.duration, 0) / result.tests.length
                    : 0,
                coverageDelta,
                memoryOverage: 0,
                cpuThrottleTime: 0,
              });
            }

            resolve({
              success: result.success,
              passed: result.passed,
              failed: result.failed,
              total: result.total,
              duration: result.duration,
              coverage: result.coverage,
              reward,
              episodesInjected: injectEpisodes && !!deps.episodicMemory,
            });
          });

          child.on('error', (error) => {
            resolve({
              success: false,
              error: String(error),
            });
          });
        });
      },
    }),
  };
}
