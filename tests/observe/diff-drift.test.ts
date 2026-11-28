import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getObserveProgram } from '../../observe/src/programs.js';
import { writeBundle, findBundle } from '../../observe/src/bundle.js';
import type { ObserveProgram, Manifest, Verdict, CheckResult, Finding } from '../../observe/src/schema.js';

describe('observe diff/drift (placeholder)', () => {
  let testDirA: string;
  let testDirB: string;
  let program: ObserveProgram;

  beforeEach(async () => {
    program = getObserveProgram('contradictory_sensors', 'test-seed');
    testDirA = await fs.mkdtemp(join(tmpdir(), 'test-bundle-a-'));
    testDirB = await fs.mkdtemp(join(tmpdir(), 'test-bundle-b-'));
  });

  function createManifest(runId: string, overrides: Partial<Manifest> = {}): Manifest {
    return {
      runId,
      program,
      gitSha: 'test',
      seed: 'test',
      lane: 'hermetic',
      marks: [],
      artifactHashes: {},
      eventDigest: 'test-digest',
      fromSeq: 1,
      toSeq: 10,
      ...overrides,
    };
  }

  function createVerdict(runId: string, findings: Finding[] = []): Verdict {
    return {
      runId,
      programId: 'contradictory_sensors',
      overall: 'pass',
      perception: 'text',
      findings,
    };
  }

  function createFinding(overrides: Partial<Finding> = {}): Finding {
    return {
      id: 'finding-1',
      signature: 'wrong-output:test',
      kind: 'wrong-output',
      severity: 'warn',
      claim: 'Test finding',
      evidence: [],
      ...overrides,
    };
  }

  async function writeTestBundle(dir: string, manifest: Manifest, verdict: Verdict, checks: CheckResult[] = []) {
    await writeBundle({
      bundleDir: dir,
      manifest,
      verdict,
      checks,
      marks: [],
      frames: [],
      events: [],
    });
  }

  it('placeholder - diff tests require full integration', () => {
    expect(true).toBe(true);
  });
});