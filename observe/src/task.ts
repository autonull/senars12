import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ulid } from 'ulid';
import { createLogger } from '@senars/util/logger';
import { governanceArtifactRegistry } from '@senars/governance/artifacts';
import { PatchRiskClassifier } from '@senars/governance/pipeline';
import type { Manifest, Verdict, Finding, CheckResult, RepairTask, EvidenceRef } from './schema.js';
import type { ObserveProgram } from './programs.js';
import { createFindingSignature } from './schema.js';
import { findFirstDivergentMark } from './bundle.js';

const logger = createLogger({ scope: 'ObserveTask' });

const GUARDRAIL_FILES = [
  'observe/src/schema.ts',
  'observe/src/checks.ts',
  'observe/src/review.ts',
  'observe/src/programs.ts',
  'src/tools/adapters/scenario-profiles.ts',
];

export async function emitTask(
  bundleDir: string,
  manifest: Manifest,
  verdict: Verdict,
  checks: CheckResult[]
): Promise<string> {
  const program = manifest.program as ObserveProgram;
  const taskId = ulid();

  const signatures = verdict.findings.map((f) => f.signature);
  const checkIds = checks.filter((c) => !c.passed).map((c) => c.checkId);

  const existingTask = findExistingTask(signatures, checkIds);
  if (existingTask) {
    logger.info('Task deduplicated', { existingTask: existingTask.taskId, newTask: taskId });
    return existingTask.taskId;
  }

  const doNotEdit = deriveDoNotEdit(program);
  const riskTier = classifyRisk(doNotEdit);

  const task: RepairTask = {
    taskId,
    baselineRunId: manifest.runId,
    baselineGitSha: manifest.gitSha,
    program,
    seed: manifest.seed,
    lane: manifest.lane,
    repro: `senars observe run --program ${program.name}`,
    findings: verdict.findings,
    checks,
    evidenceIndex: buildEvidenceIndex(verdict.findings),
    firstDivergentMark: findFirstDivergentMark(verdict.findings, manifest.marks),
    hint: {
      owner: verdict.findings[0]?.owner,
      hypothesis: verdict.findings[0]?.repairHint,
    },
    acceptance: {
      resolve: [...signatures, ...checkIds],
      noNewFindingsAtOrAbove: 'warn',
      checksMustPass: true,
      maxDurationMs: 120_000,
    },
    doNotEdit,
    riskTier,
  };

  const taskPath = join(bundleDir, 'repair-task.json');
  await fs.writeFile(taskPath, JSON.stringify(task, null, 2));

  await registerGovernanceArtifact(task);

  logger.info('Repair task emitted', { taskId, taskPath, riskTier, signatures: signatures.length, checkIds: checkIds.length });

  return taskPath;
}

function findExistingTask(signatures: string[], checkIds: string[]): RepairTask | null {
  const artifacts = governanceArtifactRegistry.getByKind('self-improvement-task' as any);
  for (const artifact of artifacts) {
    const task = artifact.content as RepairTask;
    const taskSignatures = task.acceptance.resolve;
    const overlap = signatures.some((s) => taskSignatures.includes(s)) ||
      checkIds.some((c) => taskSignatures.includes(c));
    if (overlap) return task;
  }
  return null;
}

function deriveDoNotEdit(program: ObserveProgram): string[] {
  const files = [...GUARDRAIL_FILES];
  if (program.metadata.profile !== 'auto') {
    files.push(`observe/programs/${program.metadata.profile}.observe.ts`);
  }
  return [...new Set(files)];
}

function classifyRisk(doNotEdit: string[]): 'low' | 'medium' | 'high' {
  const classifier = new PatchRiskClassifier();
  const patch = {
    affectedFiles: doNotEdit,
    affectedComponents: [],
    linesAdded: 0,
    linesRemoved: 0,
  } as any;
  const assessment = classifier.classify(patch);
  return assessment.risk.toLowerCase() as 'low' | 'medium' | 'high';
}

function buildEvidenceIndex(findings: Finding[]): Record<string, EvidenceRef[]> {
  const index: Record<string, EvidenceRef[]> = {};
  for (const finding of findings) {
    index[finding.signature] = finding.evidence;
  }
  return index;
}

async function registerGovernanceArtifact(task: RepairTask): Promise<void> {
  const artifact = {
    artifactId: task.taskId,
    kind: 'self-improvement-task' as const,
    content: task,
    version: 1,
    createdAt: Date.now(),
    createdBy: 'observe-runner' as const,
    immutableByAgent: true,
    contentHash: '',
    derivationChain: [],
  };

  const { createHash } = await import('crypto');
  artifact.contentHash = createHash('sha256').update(JSON.stringify(task)).digest('hex');

  governanceArtifactRegistry.register(artifact);
}