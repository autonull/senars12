import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import type { Manifest, Finding } from './schema.js';
import { replay } from '@senars/log/replay';
import { LogStore } from '@senars/log/store';
import type { CognitiveEvent } from '@senars/schemas/cognitive-events';
import { findBundle, readBundle, findFirstDivergentMark } from './bundle.js';

const logger = getLogger('ObserveDiff');

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
    findingsChanged: Array<{ signature: string; severityA: string; severityB: string }>;
  };
  frameHashDeltas: Array<{ markId: string; hashA: string; hashB: string }>;
  gateSnapshotDeltas: number;
  eventCountDelta: number;
  markCountDelta: number;
}

export interface BisectResult {
  badCommit: string;
  testedCommits: Array<{ sha: string; eventDigest: string; match: boolean }>;
}

export async function diffRuns(runA: string, runB: string): Promise<DiffResult> {
  const bundleA = findBundle(runA);
  const bundleB = findBundle(runB);

  if (!bundleA || !bundleB) {
    throw new Error(`Bundle not found: ${!bundleA ? runA : runB}`);
  }

  const [dataA, dataB] = await Promise.all([readBundle(bundleA), readBundle(bundleB)]);

  const manifestA = dataA.manifest!;
  const manifestB = dataB.manifest!;
  const marksA = dataA.marks;
  const marksB = dataB.marks;
  const framesA = dataA.frames;
  const framesB = dataB.frames;
  const verdictA = dataA.verdict!;
  const verdictB = dataB.verdict!;
  const eventsA = dataA.events;
  const eventsB = dataB.events;

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
  const findingsChanged: Array<{ signature: string; severityA: string; severityB: string }> = [];

  for (const [sig, finding] of findingsB) {
    if (!findingsA.has(sig)) {
      findingsAdded.push(finding);
    } else {
      const findingA = findingsA.get(sig)!;
      if (findingA.severity !== finding.severity) {
        findingsChanged.push({ signature: sig, severityA: findingA.severity, severityB: finding.severity });
      }
    }
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
    const storeA = new LogStore({ dir: join(bundleA, '..', '..', 'data', 'log') });
    await storeA.open();
    const stateA = await replayCognitiveStateFromStore(storeA, manifestA.fromSeq, manifestA.toSeq);
    await storeA.close();

    const storeB = new LogStore({ dir: join(bundleB, '..', '..', 'data', 'log') });
    await storeB.open();
    const stateB = await replayCognitiveStateFromStore(storeB, manifestB.fromSeq, manifestB.toSeq);
    await storeB.close();

    if (JSON.stringify(stateA) !== JSON.stringify(stateB)) {
      gateSnapshotDeltas = 1;
    }
  } catch (error) {
    logger.warn('Could not compare gate snapshots', { error });
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
      findingsChanged,
    },
    frameHashDeltas,
    gateSnapshotDeltas,
    eventCountDelta: eventsB.length - eventsA.length,
    markCountDelta: marksB.length - marksA.length,
  };
}

async function replayCognitiveStateFromStore(store: LogStore, fromSeq: number, toSeq: number): Promise<any> {
  const initialState = { gates: [], beliefs: [], concepts: [] };
  const reducer = (state: any, event: CognitiveEvent) => {
    if (event.type?.startsWith('gate.')) state.gates.push({ type: event.type, payload: event.payload });
    if (event.type === 'belief.revised' || event.type === 'belief.added') state.beliefs.push(event.payload);
    if (event.type === 'concept.activated') state.concepts.push(event.payload);
    return state;
  };
  const result = await replay(store, { initialState, reducer, fromSeq, toSeq });
  return result.state;
}

export async function bisect(programId: string, goodSha: string, badSha: string): Promise<BisectResult> {
  logger.info('Starting bisect', { programId, goodSha, badSha });

  const { execSync } = await import('node:child_process');
  const originalSha = execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf-8' }).trim();

  const testedCommits: BisectResult['testedCommits'] = [];

  try {
    execSync(`git bisect start ${badSha} ${goodSha}`, { cwd: process.cwd(), stdio: 'pipe' });

    const baselineResult = await runProgramInCommit(programId, goodSha);
    const baselineDigest = baselineResult.eventDigest;

    while (true) {
      const currentSha = execSync('git rev-parse HEAD', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
      logger.info('Bisect testing', { sha: currentSha });

      const runResult = await runProgramInCommit(programId, currentSha);
      const match = runResult.eventDigest === baselineDigest;

      testedCommits.push({ sha: currentSha, eventDigest: runResult.eventDigest, match });

      if (match) {
        execSync('git bisect good', { cwd: process.cwd(), stdio: 'pipe' });
      } else {
        execSync('git bisect bad', { cwd: process.cwd(), stdio: 'pipe' });
      }

      const log = execSync('git bisect log', { cwd: process.cwd(), encoding: 'utf-8' });
      if (log.includes('first bad commit')) {
        const badCommit = execSync('git rev-parse $(git bisect bad)', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        logger.info('Bisect found regression', { badCommit });
        return { badCommit, testedCommits };
      }

      if (testedCommits.length > 50) {
        logger.warn('Bisect max iterations reached');
        break;
      }
    }

    return { badCommit: '', testedCommits };
  } catch (error) {
    logger.error('Bisect failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    try {
      execSync('git bisect reset', { cwd: process.cwd(), stdio: 'pipe' });
      execSync(`git checkout ${originalSha}`, { cwd: process.cwd(), stdio: 'pipe' });
    } catch {
      // Ignore cleanup errors
    }
  }
}

import type { ScenarioProfile } from './programs.js';

async function runProgramInCommit(programId: string, sha: string): Promise<{ eventDigest: string; baselineDigest: string }> {
  const { execSync } = await import('node:child_process');
  execSync(`git checkout ${sha}`, { cwd: process.cwd(), stdio: 'pipe' });

  const { observeRun } = await import('./run.js');
  const { getObserveProgram } = await import('./programs.js');
  const program = getObserveProgram(programId as ScenarioProfile, 'bisect-seed');

  const result = await observeRun({ program, deps: { nar: null }, runReview: false });

  return { eventDigest: result.eventDigest, baselineDigest: '' };
}