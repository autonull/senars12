import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { parseCoverageFiles, type FileCoverage } from './vitest-json.js';

// --- coverage_concepts ---

export interface CoverageConceptDeps {
  workspaceRoot?: string;
  memory?: any; // NAR Memory instance
  threshold?: number; // Coverage threshold (default 80%)
}

export function createCoverageConceptTools(deps: CoverageConceptDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const outputFile = resolve(workspaceRoot, '.vitest/json/output.json');
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
        injectEpisodes: z.boolean().optional().default(true).describe('Inject coverage episodes'),
      }),
      execute: async ({ testPath, threshold: userThreshold, injectEpisodes = true }) => {
        const effectiveThreshold = userThreshold ?? threshold;

        // Run tests with coverage
        const args = ['run', '--reporter=json', '--coverage'];
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

          child.on('close', async (_exitCode) => {
            // Read and parse coverage
            let fileCoverages: FileCoverage[] = [];
            try {
              const { readFile } = await import('node:fs/promises');
              const outputContent = await readFile(outputFile, 'utf-8');
              fileCoverages = parseCoverageFiles(outputContent);
            } catch {
              resolve({
                success: false,
                error: 'Failed to read coverage output',
                stderr: stderr.slice(0, 1000),
              });
              return;
            }

            if (fileCoverages.length === 0) {
              resolve({
                success: true,
                message: 'No coverage data found',
                conceptsInjected: 0,
              });
              return;
            }

            // Filter files below threshold
            const lowCoverageFiles = fileCoverages.filter((f) => f.lines.pct < effectiveThreshold);

            let conceptsInjected = 0;
            const injectedConcepts: string[] = [];

            // Inject concepts into NAR memory if available
            if (deps.memory && lowCoverageFiles.length > 0) {
              try {
                // Import NAR types dynamically to avoid circular deps
                // @ts-expect-error - dynamic import resolution
                const { TermBuilder, atom } = await import('../terms/index.js');

                for (const fc of lowCoverageFiles) {
                  // Create a term representing the file
                  const fileName = fc.path.split('/').pop()?.replace(/\.ts$/, '') || 'unknown';
                  const term = TermBuilder.atom(`coverage_${fileName}`);

                  // Get or create concept
                  let concept = deps.memory.getConcept(term);
                  if (!concept) {
                    concept = deps.memory.addConcept(term);
                  }

                  // Set priority based on coverage gap: priority = 1 - (coverage / 100)
                  // So 0% coverage = priority 1.0, 50% coverage = priority 0.5, 79% coverage = priority 0.21
                  const priority = 1 - fc.lines.pct / 100;
                  concept.priority = Math.max(0.01, priority);

                  // Add a belief about the coverage
                  // @ts-expect-error - dynamic import resolution
                  const { Truth } = await import('../terms/truth.js');
                  const beliefTruth = Truth.create(
                    fc.lines.pct / 100, // frequency = coverage percentage
                    0.9 // high confidence
                  );

                  const { gateRegistry } = await import('../../kernel/index.js');
                  if (
                    gateRegistry
                      .getPerceptionGate()
                      .admitTask(term, 'belief', beliefTruth, 'coverage-sensor').admitted
                  ) {
                    deps.memory.addTask(term, 'belief', beliefTruth);
                  }

                  // Add a goal to improve coverage
                  const goalTruth = Truth.create(0.5, 0.8);
                  if (
                    gateRegistry
                      .getPerceptionGate()
                      .admitTask(term, 'goal', goalTruth, 'coverage-sensor').admitted
                  ) {
                    deps.memory.addTask(term, 'goal', goalTruth);
                  }

                  conceptsInjected++;
                  injectedConcepts.push(
                    `${fileName}: ${fc.lines.pct.toFixed(1)}% -> priority ${priority.toFixed(2)}`
                  );
                }
              } catch (error) {
                console.warn('Failed to inject coverage concepts:', error);
              }
            }

            // Inject episodes if requested
            if (injectEpisodes && deps.memory) {
              // We'd need episodicMemory for this, skip for now
            }

            resolve({
              success: true,
              totalFiles: fileCoverages.length,
              lowCoverageFiles: lowCoverageFiles.length,
              conceptsInjected,
              threshold: effectiveThreshold,
              injectedConcepts,
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
