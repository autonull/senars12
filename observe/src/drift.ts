import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '@senars/util/logger';
import type { Manifest, Finding } from './schema.js';
import { diffRuns } from './diff.js';
import { findBundle } from './bundle.js';

const logger = createLogger({ scope: 'ObserveDrift' });

export interface DriftResult {
  passed: boolean;
  baselineRunId: string;
  currentRunId: string;
  eventDigestMatch: boolean;
  frameSimilarity: number;
  gateStateMatch: boolean;
  details: string[];
}

export async function runDriftGate(currentRunId: string): Promise<DriftResult> {
  const baselineRunId = await findBaselineRun(currentRunId);
  if (!baselineRunId) {
    return {
      passed: true,
      baselineRunId: '',
      currentRunId,
      eventDigestMatch: true,
      frameSimilarity: 1,
      gateStateMatch: true,
      details: ['No baseline run found; drift check skipped'],
    };
  }

  // Verify the baseline bundle exists
  const baselineBundleDir = findBundle(baselineRunId);
  if (!baselineBundleDir) {
    return {
      passed: true,
      baselineRunId: '',
      currentRunId,
      eventDigestMatch: true,
      frameSimilarity: 1,
      gateStateMatch: true,
      details: ['Baseline bundle not found; drift check skipped'],
    };
  }

  const diff = await diffRuns(baselineRunId, currentRunId);

  const frameSimilarity = calculateFrameSimilarity(diff);
  const gateStateMatch = diff.gateSnapshotDeltas === 0;
  const eventDigestMatch = diff.eventDigestMatch;

  const passed = eventDigestMatch && frameSimilarity > 0.95 && gateStateMatch;

  const details: string[] = [];
  if (!eventDigestMatch) details.push('Event digest mismatch - event log changed');
  if (frameSimilarity <= 0.95) details.push(`Frame similarity below threshold: ${(frameSimilarity * 100).toFixed(1)}%`);
  if (!gateStateMatch) details.push('Gate state changed between runs');

  if (diff.verdictDelta.findingsAdded.length > 0) {
    details.push(`${diff.verdictDelta.findingsAdded.length} new findings detected`);
  }
  if (diff.verdictDelta.findingsRemoved.length > 0) {
    details.push(`${diff.verdictDelta.findingsRemoved.length} findings resolved`);
  }
  if (diff.verdictDelta.findingsChanged.length > 0) {
    details.push(`${diff.verdictDelta.findingsChanged.length} findings changed severity`);
  }

  return {
    passed,
    baselineRunId,
    currentRunId,
    eventDigestMatch,
    frameSimilarity,
    gateStateMatch,
    details,
  };
}

async function findBaselineRun(currentRunId: string): Promise<string | null> {
  const fixturesDir = join(process.cwd(), 'fixtures', 'observe');
  try {
    const entries = await fs.readdir(fixturesDir);
    for (const entry of entries) {
      const manifestPath = join(fixturesDir, entry, 'manifest.json');
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as Manifest;
        if (manifest.fixedRunId === currentRunId || manifest.originalRunId === currentRunId) {
          // Verify the bundle exists
          const bundleDir = findBundle(entry);
          if (bundleDir) return entry;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Fixtures dir doesn't exist
  }
  return null;
}

function calculateFrameSimilarity(diff: Awaited<ReturnType<typeof diffRuns>>): number {
  if (diff.frameHashDeltas.length === 0) return 1;
  
  const totalFrames = diff.frameHashDeltas.length + 
    Math.max(diff.verdictDelta.findingsAdded.length, diff.verdictDelta.findingsRemoved.length);
  
  if (totalFrames === 0) return 1;
  
  return 1 - diff.frameHashDeltas.length / totalFrames;
}