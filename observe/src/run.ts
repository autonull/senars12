import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import { generateId } from './schema.js';
import type { ScenarioSpec } from '@senars/tools/adapters/scenario-execute';
import { runScenario, type ScenarioRunnerDeps, type ScenarioResult } from '@senars/tools/adapters/scenario-execute';
import { EventBus } from '@senars/events/event-bus';
import { Recorder, createRecorder } from './record.js';
import { runChecks, type CheckResult } from './checks.js';
import { reviewBundle, type Verdict } from './review.js';
import { renderReport } from './report.js';
import { emitTask } from './task.js';
import { runFailureHooks, createFailureBundle, hasActionableFindings } from './hooks.js';
import type { ObserveProgram } from './programs.js';
import type { Manifest, Finding, CheckResult as CheckResultType } from './schema.js';

const logger = getLogger('ObserveRun');

export interface ObserveRunOptions {
  program: ObserveProgram;
  deps: ScenarioRunnerDeps;
  bundleDir?: string;
  runReview?: boolean;
}

export interface ObserveRunResult {
  runId: string;
  bundleDir: string;
  manifest: Manifest;
  eventDigest: string;
  scenarioResult: ScenarioResult;
  checks: CheckResult[];
  verdict: Verdict;
  reportPath: string;
  taskPath?: string;
}

export async function observeRun(options: ObserveRunOptions): Promise<ObserveRunResult> {
  const runId = generateId();
  const bundleDir = options.bundleDir ?? join(process.cwd(), '.cache', 'observations', runId);
  await fs.mkdir(bundleDir, { recursive: true });

  logger.info('Starting observe run', { runId, program: options.program.name });

  const eventBus = new EventBus();
  const recorder = await createRecorder({
    bundleDir,
    surfaces: options.program.observe.surfaces,
    keyframeMarks: options.program.observe.keyframeMarks,
    maxFrames: options.program.observe.maxFrames,
    lane: options.program.observe.lane,
    eventBus,
    uiUrl: options.program.observe.uiUrl,
  });

  const scenarioSpec: ScenarioSpec = {
    name: options.program.name,
    description: options.program.description,
    duration_steps: options.program.duration_steps,
    inject: options.program.inject,
    success_criteria: options.program.success_criteria,
    metadata: options.program.metadata,
  };

  const scenarioResult = await runScenario(options.deps.nar, scenarioSpec);

  const { manifest, eventDigest } = await recorder.stop();

  manifest.runId = runId;
  manifest.program = options.program;
  manifest.seed = options.program.metadata.seed;
  manifest.fromSeq = 1;
  manifest.toSeq = recorder.getEventSeq();

  await fs.writeFile(join(bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const checks = await runChecks(bundleDir, options.program);
  await fs.writeFile(join(bundleDir, 'checks.json'), JSON.stringify(checks, null, 2));

  let verdict: Verdict;
  if (options.runReview !== false) {
    verdict = await reviewBundle(bundleDir, options.program, checks);
  } else {
    verdict = {
      runId,
      programId: options.program.name,
      overall: checks.some((c) => !c.passed) ? 'fail' : 'pass',
      perception: 'text',
      findings: [],
    };
  }
  await fs.writeFile(join(bundleDir, 'verdict.json'), JSON.stringify(verdict, null, 2));

  const report = renderReport(manifest, verdict, checks);
  const reportPath = join(bundleDir, 'report.md');
  await fs.writeFile(reportPath, report);

  let taskPath: string | undefined;
  if (verdict.overall !== 'pass' && verdict.overall !== 'uncertain') {
    taskPath = await emitTask(bundleDir, manifest, verdict, checks);
  }

  if (hasActionableFindings(verdict, checks)) {
    const failureBundle = createFailureBundle(runId, options.program, manifest, verdict, checks);
    await runFailureHooks(failureBundle);
  }

  logger.info('Observe run completed', { runId, verdict: verdict.overall, taskPath });

  return {
    runId,
    bundleDir,
    manifest,
    eventDigest,
    scenarioResult,
    checks,
    verdict,
    reportPath,
    taskPath,
  };
}

export async function observeRecord(
  command: string,
  name: string,
  surfaces: ('console' | 'ui')[] = ['console'],
  lane: 'hermetic' | 'live' = 'hermetic',
  uiUrl?: string
): Promise<{ runId: string; bundleDir: string; manifest: Manifest }> {
  const runId = name;
  const bundleDir = join(process.cwd(), '.cache', 'observations', runId);
  await fs.mkdir(bundleDir, { recursive: true });

  logger.info('Starting ad-hoc recording', { runId, command });

  const eventBus = new EventBus();
  const recorder = await createRecorder({
    bundleDir,
    surfaces,
    keyframeMarks: [],
    maxFrames: 100,
    lane,
    eventBus,
    uiUrl,
  });

  const { spawn } = await import('node:child_process');
  const child = spawn(command, { shell: true, stdio: 'inherit' });

  await new Promise<void>((resolve, reject) => {
    child.on('exit', (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}`));
    });
    child.on('error', reject);
  });

  const { manifest, eventDigest } = await recorder.stop();
  manifest.runId = runId;
  manifest.program = { name: 'ad-hoc', observe: { surfaces, keyframeMarks: [], maxFrames: 100, lane } };
  manifest.seed = 'ad-hoc';
  manifest.fromSeq = 1;
  manifest.toSeq = recorder.getEventSeq();

  await fs.writeFile(join(bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  logger.info('Ad-hoc recording completed', { runId });

  return { runId, bundleDir, manifest };
}