import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import { execSync } from 'node:child_process';
import { replay } from '@senars/log/replay';
import { LogStore } from '@senars/log/store';
import type { CognitiveEvent, LogEntry } from '@senars/log/events';
import { PatchRiskClassifier } from '@senars/governance/pipeline';
import type { RepairTask, Manifest, Verdict, Finding, CheckResult } from './schema.js';
import { runChecks } from './checks.js';
import { reviewBundle } from './review.js'
import type { ObserveProgram } from './programs.js';
import { findBundle, readBundle, findFirstDivergentMark, writeBundle } from './bundle.js';

const logger = getLogger('ObserveVerify');

export interface VerifyResult {
  accepted: boolean;
  runId: string;
  criteria: {
    resolve: Record<string, boolean>;
    noNewFindings: boolean;
    checksPass: boolean;
    durationOk: boolean;
  };
  details: string[];
  newVerdict?: Verdict;
  newChecks?: CheckResult[];
  firstDivergentMark?: string;
}

export async function verifyTask(taskPath: string, worktreePath: string): Promise<VerifyResult> {
  const startTime = Date.now();

  const taskContent = await fs.readFile(taskPath, 'utf-8');
  const task = JSON.parse(taskContent) as RepairTask;

  logger.info('Starting verification', { taskId: task.taskId, worktreePath });

  const graderGuard = await checkGraderGuard(task, worktreePath);
  if (!graderGuard.passed) {
    return {
      accepted: false,
      runId: '',
      criteria: { resolve: {}, noNewFindings: false, checksPass: false, durationOk: true },
      details: [`Grader guard failed: ${graderGuard.reason}`],
    };
  }

  const baselineBundleDir = findBundle(task.baselineRunId);
  if (!baselineBundleDir) {
    return {
      accepted: false,
      runId: '',
      criteria: { resolve: {}, noNewFindings: false, checksPass: false, durationOk: true },
      details: ['Baseline bundle not found'],
    };
  }

  const data = await readBundle(baselineBundleDir);
  const manifest = data.manifest!;
  const fromSeq = manifest.fromSeq;
  const toSeq = manifest.toSeq;

  const logStore = new LogStore({ dir: join(worktreePath, 'data', 'log') });
  await logStore.open();

  const initialState = { events: [] as CognitiveEvent[] };
  const reducer = (state: { events: CognitiveEvent[] }, event: CognitiveEvent) => {
    state.events.push(event);
    return state;
  };

  const replayResult = await replay(logStore, {
    initialState,
    reducer,
    fromSeq,
    toSeq,
  });

  const newRunId = `verify_${Date.now()}`;
  const newBundleDir = join(worktreePath, '.cache', 'observations', newRunId);
  await fs.mkdir(newBundleDir, { recursive: true });

  const events = replayResult.state.events.map((e, i) => ({ seq: fromSeq + i, ts: Date.now(), event: e }));

  await writeBundle({
    bundleDir: newBundleDir,
    manifest: { ...manifest, runId: newRunId, fromSeq, toSeq },
    marks: data.marks,
    frames: data.frames,
    events,
  });

  const program = task.program as ObserveProgram;
  const checks = await runChecks(newBundleDir, program);
  const verdict = await reviewBundle(newBundleDir, program, checks);

  await writeBundle({
    bundleDir: newBundleDir,
    manifest: { ...manifest, runId: newRunId, fromSeq, toSeq },
    verdict,
    checks,
  });

  const criteria = evaluateAcceptance(task, verdict, checks, manifest);
  const accepted = Object.values(criteria.resolve).every((v: boolean) => v) && criteria.noNewFindings && criteria.checksPass && criteria.durationOk;

  const duration = Date.now() - startTime;
  criteria.durationOk = duration <= task.acceptance.maxDurationMs;

  const result: VerifyResult = {
    accepted,
    runId: newRunId,
    criteria,
    details: buildDetails(criteria, task, verdict),
    newVerdict: verdict,
    newChecks: checks,
    firstDivergentMark: findFirstDivergentMark(verdict.findings, manifest.marks),
  };

  await fs.writeFile(join(newBundleDir, 'verification.json'), JSON.stringify(result, null, 2));

  logger.info('Verification completed', { accepted, taskId: task.taskId, newRunId, duration });

  return result;
}

async function checkGraderGuard(task: RepairTask, worktreePath: string): Promise<{ passed: boolean; reason: string }> {
  try {
    const diffOutput = execSync(`git diff ${task.baselineGitSha} -- ${task.doNotEdit.join(' ')}`, {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    if (diffOutput) {
      return { passed: false, reason: `Grader files modified: ${task.doNotEdit.join(', ')}` };
    }

    interface RiskPatch {
    affectedFiles: string[];
    affectedComponents: string[];
    linesAdded: number;
    linesRemoved: number;
  }

    const classifier = new PatchRiskClassifier();
    const patch: RiskPatch = {
      affectedFiles: task.doNotEdit,
      affectedComponents: [],
      linesAdded: 0,
      linesRemoved: 0,
    };
    const assessment = classifier.classify(patch);

    if (assessment.risk === 'HIGH') {
      return { passed: false, reason: `PatchRiskClassifier: HIGH risk on grader files (${assessment.factors.map((f: { factor: string }) => f.factor).join(', ')})` };
    }

    return { passed: true, reason: 'Grader guard passed' };
  } catch (error) {
    return { passed: false, reason: `Grader guard check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function evaluateAcceptance(
  task: RepairTask,
  verdict: Verdict,
  checks: CheckResult[],
  baselineManifest: Manifest
): VerifyResult['criteria'] {
  const baselineSignatures = new Set(task.acceptance.resolve);

  const newFindingSignatures = new Set(verdict.findings.map((f) => f.signature));
  const newCheckIds = new Set(checks.filter((c) => !c.passed).map((c) => c.checkId));

  const resolve: Record<string, boolean> = {};
  for (const sig of baselineSignatures) {
    resolve[sig] = !newFindingSignatures.has(sig) && !newCheckIds.has(sig);
  }

  const noNewFindings = !verdict.findings.some((f) =>
    f.severity === 'warn' || f.severity === 'fail'
  ) && !(newFindingSignatures.size > baselineSignatures.size);

  const checksPass = checks.every((c) => c.passed);

  return {
    resolve,
    noNewFindings,
    checksPass,
    durationOk: true,
  };
}

function buildDetails(criteria: VerifyResult['criteria'], task: RepairTask, verdict: Verdict): string[] {
  const details: string[] = [];

  for (const [sig, resolved] of Object.entries(criteria.resolve)) {
    details.push(`${resolved ? '✅' : '❌'} Resolve ${sig}: ${resolved ? 'cleared' : 'still present'}`);
  }

  details.push(`${criteria.noNewFindings ? '✅' : '❌'} No new findings ≥ warn: ${criteria.noNewFindings}`);
  details.push(`${criteria.checksPass ? '✅' : '❌'} All checks pass: ${criteria.checksPass}`);
  details.push(`${criteria.durationOk ? '✅' : '❌'} Duration within cap: ${criteria.durationOk}`);

  if (!criteria.noNewFindings) {
    for (const finding of verdict.findings) {
      if (finding.severity === 'warn' || finding.severity === 'fail') {
        if (!task.acceptance.resolve.includes(finding.signature)) {
          details.push(`  New finding: ${finding.signature} (${finding.severity}) - ${finding.claim}`);
        }
      }
    }
  }

  return details;
}