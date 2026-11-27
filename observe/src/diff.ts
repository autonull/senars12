import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from 'senars/util/logger';
import type { Manifest, Finding } from './schema.js';
import { replayCognitiveState } from 'senars/log/replay-reducers';

const logger = createLogger({ scope: 'ObserveDiff' });

export interface DiffResult {
  runA: string;
  runB: string;
  eventDigestMatch: boolean;
  firstDivergentMark?: string;
  verdictDelta: {
    overallA: string;
    overallB: string;
    findingsAdded: Finding[];
    findingsRemoved: Finding[];
  };
  frameHashDeltas: Array<{ markId: string; hashA: string; hashB: string }>;
  gateSnapshotDeltas: number;
}

export async function diffRuns(runA: string, runB: string): Promise<DiffResult> {
  const bundleA = findBundle(runA);
  const bundleB = findBundle(runB);

  if (!bundleA || !bundleB) {
    throw new Error(`Bundle not found: ${!bundleA ? runA : runB}`);
  }

  const [manifestA, manifestB, marksA, marksB, framesA, framesB, verdictA, verdictB] = await Promise.all([
    readManifest(bundleA),
    readManifest(bundleB),
    readMarks(bundleA),
    readMarks(bundleB),
    readFrames(bundleA),
    readFrames(bundleB),
    readVerdict(bundleA),
    readVerdict(bundleB),
  ]);

  const eventDigestMatch = manifestA.eventDigest === manifestB.eventDigest;

  const markMapA = new Map(marksA.map((m) => [m.id, m]));
  const markMapB = new Map(marksB.map((m) => [m.id, m]));

  let firstDivergentMark: string | undefined;
  for (const mark of marksA) {
    const markB = markMapB.get(mark.id);
    if (!markB) {
      firstDivergentMark = mark.id;
      break;
    }
    const frameA = framesA.find((f) => f.markId === mark.id);
    const frameB = framesB.find((f) => f.markId === mark.id);
    if (frameA && frameB && frameA.hash !== frameB.hash) {
      firstDivergentMark = mark.id;
      break;
    }
  }

  const findingsA = new Map(verdictA.findings.map((f) => [f.signature, f]));
  const findingsB = new Map(verdictB.findings.map((f) => [f.signature, f]));

  const findingsAdded: Finding[] = [];
  const findingsRemoved: Finding[] = [];

  for (const [sig, finding] of findingsB) {
    if (!findingsA.has(sig)) findingsAdded.push(finding);
  }
  for (const [sig, finding] of findingsA) {
    if (!findingsB.has(sig)) findingsRemoved.push(finding);
  }

  const frameHashDeltas: Array<{ markId: string; hashA: string; hashB: string }> = [];
  for (const frameA of framesA) {
    const frameB = framesB.find((f) => f.markId === frameA.markId);
    if (frameB && frameA.hash !== frameB.hash) {
      frameHashDeltas.push({ markId: frameA.markId, hashA: frameA.hash, hashB: frameB.hash });
    }
  }

  let gateSnapshotDeltas = 0;
  try {
    const stateA = await replayCognitiveState(manifestA.fromSeq, manifestA.toSeq);
    const stateB = await replayCognitiveState(manifestB.fromSeq, manifestB.toSeq);
    if (JSON.stringify(stateA) !== JSON.stringify(stateB)) {
      gateSnapshotDeltas = 1;
    }
  } catch {
    gateSnapshotDeltas = -1;
  }

  return {
    runA,
    runB,
    eventDigestMatch,
    firstDivergentMark,
    verdictDelta: {
      overallA: verdictA.overall,
      overallB: verdictB.overall,
      findingsAdded,
      findingsRemoved,
    },
    frameHashDeltas,
    gateSnapshotDeltas,
  };
}

export async function bisect(programId: string, goodSha: string, badSha: string): Promise<string> {
  logger.info('Starting bisect', { programId, goodSha, badSha });

  const { execSync } = await import('node:child_process');

  execSync(`git bisect start ${badSha} ${goodSha}`, { cwd: process.cwd(), stdio: 'inherit' });

  try {
    while (true) {
      const currentSha = execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
      logger.info('Bisect testing', { sha: currentSha });

      const runResult = await runProgramInCommit(programId, currentSha);

      if (runResult.eventDigest === runResult.baselineDigest) {
        execSync('git bisect good', { cwd: process.cwd(), stdio: 'inherit' });
      } else {
        execSync('git bisect bad', { cwd: process.cwd(), stdio: 'inherit' });
      }

      const status = execSync('git bisect log', { cwd: process.cwd(), encoding: 'utf-8' });
      if (status.includes('first bad commit')) {
        const badCommit = execSync('git bisect bad', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        logger.info('Bisect found regression', { badCommit });
        return badCommit;
      }
    }
  } finally {
    execSync('git bisect reset', { cwd: process.cwd(), stdio: 'inherit' });
  }
}

async function runProgramInCommit(programId: string, sha: string): Promise<{ eventDigest: string; baselineDigest: string }> {
  const { execSync } = await import('node:child_process');
  execSync(`git checkout ${sha}`, { cwd: process.cwd(), stdio: 'inherit' });

  const { observeRun } = await import('./run.js');
  const { getObserveProgram } = await import('./programs.js');
  const program = getObserveProgram(programId as any, 'bisect-seed');

  const result = await observeRun({ program, deps: { nar: null } });

  return { eventDigest: result.eventDigest, baselineDigest: '' };
}

function findBundle(runId: string): string | null {
  const possiblePaths = [
    join(process.cwd(), '.cache', 'observations', runId),
    join(process.cwd(), 'generated', 'observations', runId),
  ];
  for (const path of possiblePaths) {
    try {
      require('node:fs').accessSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

async function readManifest(bundleDir: string): Promise<Manifest> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'manifest.json'), 'utf-8'));
}

async function readMarks(bundleDir: string): Promise<any[]> {
  const content = await fs.readFile(join(bundleDir, 'marks.jsonl'), 'utf-8').catch(() => '');
  return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function readFrames(bundleDir: string): Promise<any[]> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'frames.json'), 'utf-8').catch(() => '[]'));
}

async function readVerdict(bundleDir: string): Promise<{ overall: string; findings: Finding[] }> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'verdict.json'), 'utf-8').catch(() => '{"overall":"unknown","findings":[]}'));
}