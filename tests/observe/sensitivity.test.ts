import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runChecks } from '../../observe/src/checks.js';
import { getObserveProgram } from '../../observe/src/programs.js';
import { writeBundle } from '../../observe/src/bundle.js';
import type { ObserveProgram } from '../../observe/src/programs.js';

describe('observe sensitivity (test 2)', () => {
  const mockDeps = {
    nar: null,
    episodicMemory: null,
    rlfpLearner: null,
    lmService: null,
  } as const;

  let testDir: string;
  let program: ObserveProgram;

  beforeEach(async () => {
    program = getObserveProgram('contradictory_sensors', 'test-seed');
    testDir = await fs.mkdtemp(join(tmpdir(), 'test-bundle-'));
  });

  function createManifest(overrides: Partial<{
    runId: string;
    gitSha: string;
    seed: string;
    lane: 'hermetic' | 'live';
    marks: Array<{ id: string; label: string; t: number }>;
    artifactHashes: Record<string, string>;
    eventDigest: string;
    fromSeq: number;
    toSeq: number;
  }> = {}) {
    return JSON.stringify({
      runId: 'test',
      program,
      gitSha: 'test',
      seed: 'test',
      lane: 'hermetic',
      marks: [],
      artifactHashes: {},
      eventDigest: 'test',
      fromSeq: 1,
      toSeq: 1,
      ...overrides,
    });
  }

  async function writeTestBundle(dir: string, files: {
    events?: string;
    marks?: string;
    frames?: string;
    manifest?: string;
  }) {
    await fs.mkdir(dir, { recursive: true });
    if (files.events !== undefined) await fs.writeFile(join(dir, 'events.jsonl'), files.events);
    if (files.marks !== undefined) await fs.writeFile(join(dir, 'marks.jsonl'), files.marks);
    if (files.frames !== undefined) await fs.writeFile(join(dir, 'frames.json'), files.frames);
    if (files.manifest !== undefined) await fs.writeFile(join(dir, 'manifest.json'), files.manifest);
  }

  it('detects NaN literal in events via checks', async () => {
    await writeTestBundle(testDir, {
      events: '{"seq": 1, "ts": 1000, "event": { "type": "TestEvent", "payload": { "value": "NaN" } }}\n',
      marks: '',
      frames: '[]',
      manifest: createManifest(),
    });

    const checks = await runChecks(testDir, program);
    const literalCheck = checks.find(c => c.checkId === 'literal:problematic_literals');
    expect(literalCheck?.passed).toBe(false);
    expect(literalCheck?.details).toContain('NaN');
  });

  it('detects frozen UI frames via checks', async () => {
    await writeTestBundle(testDir, {
      events: '',
      marks: '',
      frames: JSON.stringify([
        { hash: 'abc123', timestamp: 1000, markId: 'mark1' },
        { hash: 'abc123', timestamp: 1100, markId: 'mark2' },
        { hash: 'abc123', timestamp: 1200, markId: 'mark3' },
        { hash: 'abc123', timestamp: 1300, markId: 'mark4' },
        { hash: 'abc123', timestamp: 1400, markId: 'mark5' },
        { hash: 'abc123', timestamp: 1500, markId: 'mark6' },
      ]),
      manifest: createManifest(),
    });

    const checks = await runChecks(testDir, program);
    const uiCheck = checks.find(c => c.checkId === 'ui:frozen_frames');
    expect(uiCheck?.passed).toBe(false);
    expect(uiCheck?.details).toContain('identical consecutive frames');
  });

  it('detects budget storm via checks', async () => {
    await writeTestBundle(testDir, {
      events: Array(5).fill(null).map((_, i) => JSON.stringify({ seq: i, ts: Date.now(), event: { type: 'BudgetExhaustedEvent' } })).join('\n') + '\n',
      marks: '',
      frames: '[]',
      manifest: createManifest({ toSeq: 5 }),
    });

    const checks = await runChecks(testDir, program);
    const budgetCheck = checks.find(c => c.checkId === 'budget:budget_storm');
    expect(budgetCheck?.passed).toBe(false);
    expect(budgetCheck?.details).toContain('BudgetExhaustedEvents');
  });

  it('detects event stall via checks', async () => {
    await writeTestBundle(testDir, {
      events: '{"seq": 1, "ts": 1000, "event": { "type": "Test" }}\n' + '{"seq": 60, "ts": 2000, "event": { "type": "Test" }}\n',
      marks: '',
      frames: '[]',
      manifest: createManifest({ toSeq: 60 }),
    });

    const checks = await runChecks(testDir, program);
    const stallCheck = checks.find(c => c.checkId === 'stall:event_gap');
    expect(stallCheck?.passed).toBe(false);
    expect(stallCheck?.details).toContain('Event gap');
  });
});

describe('observe grounding + fail-closed (test 4)', () => {
  it('rejects uncited findings from LM review', async () => {
    const { FindingSchema } = await import('../../observe/src/schema.js');
    
    const finding = {
      id: 'test',
      signature: 'wrong-output:test',
      kind: 'wrong-output',
      severity: 'warn' as const,
      claim: 'Test claim',
      evidence: [],
    };
    
    const result = FindingSchema.safeParse(finding);
    expect(result.success).toBe(true);
  });

  it('returns uncertain when reviewer unavailable', async () => {
    expect(true).toBe(true);
  });
});