import { tool } from 'ai';
import { z } from 'zod';
import { parseCoverageFiles } from './vitest-json.js';
import { runVitestJson } from './vitest-run.js';

// --- coverage_concepts ---

export interface CoverageConceptDeps {
  workspaceRoot?: string;
  memory?: any; // NAR Memory instance
  threshold?: number; // Coverage threshold (default 80%)
}

export function createCoverageConceptTools(deps: CoverageConceptDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const threshold = deps.threshold ?? 80;

  return {
    coverage_concepts: tool({
      description:
        'Run tests with coverage and inject low-coverage files as high-priority concepts into NAR memory. Files with coverage < threshold get priority = 1 - coverage.',
      inputSchema: z.strictObject({
        testPath: z.string().optional().describe('Specific test file or directory to run'),
        threshold: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .default(threshold)
          .describe('Coverage threshold (files below get concepts)'),
      }),
      execute: async ({ testPath, threshold: userThreshold }) => {
        const effectiveThreshold = userThreshold ?? threshold;

        const run = await runVitestJson({ workspaceRoot, testPath, coverage: true });
        const fileCoverages = run.output ? parseCoverageFiles(run.output) : [];
        if (fileCoverages.length === 0) {
          return run.output
            ? { success: true, message: 'No coverage data found', conceptsInjected: 0 }
            : {
                success: false,
                error: 'Failed to read coverage output',
                stderr: run.stderr.slice(0, 1000),
              };
        }

        const lowCoverageFiles = fileCoverages.filter((f) => f.lines.pct < effectiveThreshold);
        const injectedConcepts: string[] = [];

        if (deps.memory && lowCoverageFiles.length > 0) {
          try {
            // Dynamic imports keep NAR types out of the tool-adapter module graph.
            // @ts-expect-error - dynamic import resolution
            const { TermBuilder } = await import('../terms/index.js');
            // @ts-expect-error - dynamic import resolution
            const { Truth } = await import('../terms/impls/Truth.js');
            const { createGateRegistry } = await import('../../kernel/index.js');
            const admit = createGateRegistry().getPerceptionGate();

            for (const fc of lowCoverageFiles) {
              const fileName = fc.path.split('/').pop()?.replace(/\.ts$/, '') || 'unknown';
              const term = TermBuilder.atom(`coverage_${fileName}`);
              const concept = deps.memory.getConcept(term) ?? deps.memory.addConcept(term);
              const priority = 1 - fc.lines.pct / 100;
              concept.writeAttention({ reason: 'assign', value: Math.max(0.01, priority) });

              const beliefTruth = Truth.create(fc.lines.pct / 100, 0.9);
              if (admit.admitTask(term, 'belief', beliefTruth, 'coverage-sensor').admitted) {
                deps.memory.addTask(term, 'belief', beliefTruth);
              }
              const goalTruth = Truth.create(0.5, 0.8);
              if (admit.admitTask(term, 'goal', goalTruth, 'coverage-sensor').admitted) {
                deps.memory.addTask(term, 'goal', goalTruth);
              }

              injectedConcepts.push(
                `${fileName}: ${fc.lines.pct.toFixed(1)}% -> priority ${priority.toFixed(2)}`
              );
            }
          } catch (error) {
            console.warn('Failed to inject coverage concepts:', error);
          }
        }

        return {
          success: true,
          totalFiles: fileCoverages.length,
          lowCoverageFiles: lowCoverageFiles.length,
          conceptsInjected: injectedConcepts.length,
          threshold: effectiveThreshold,
          injectedConcepts,
        };
      },
    }),
  };
}
