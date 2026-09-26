import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JudgmentDataset } from '../../nar/src/lm/system-one/distill.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('JudgmentDataset — File Persistence (R8)', () => {
  const testFile = join(tmpdir(), 'test-judgment-dataset.jsonl');
  const testBasePath = join(tmpdir(), 'test-judgment-dataset-base');

  beforeEach(async () => {
    try {
      await fs.unlink(testFile);
    } catch {
      // Ignore
    }
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFile);
    } catch {
      // Ignore
    }
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('flush writes labels to JSONL file', async () => {
    const dataset = new JudgmentDataset(testBasePath);
    dataset.record({
      evidenceId: 'abc123',
      rubric: 'task_type',
      axis: 'epistemic',
      label: 'belief',
      source: 'FeedbackLearner.onCorrection',
    });
    dataset.record({
      evidenceId: 'def456',
      rubric: 'injection',
      axis: 'epistemic',
      label: 'rejected',
      source: 'ApprovalService',
    });

    await dataset.flush(testFile);

    const content = await fs.readFile(testFile, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).evidenceId).toBe('abc123');
    expect(JSON.parse(lines[1]!).evidenceId).toBe('def456');
  });

  it('load reads labels from JSONL file', async () => {
    // Create a test file
    const content = [
      JSON.stringify({
        evidenceId: 'aaa',
        rubric: 'conflict',
        axis: 'epistemic',
        label: 'support',
        source: 'ShadowValidator',
      }),
      JSON.stringify({
        evidenceId: 'bbb',
        rubric: 'risk',
        axis: 'teleological',
        label: 'approved',
        source: 'ApprovalService',
      }),
    ].join('\n') + '\n';

    await fs.writeFile(testFile, content, 'utf-8');

    const dataset = await JudgmentDataset.load(testFile);

    expect(dataset.size).toBe(2);
    expect(dataset.all()[0]!.evidenceId).toBe('aaa');
    expect(dataset.all()[1]!.evidenceId).toBe('bbb');
  });

  it('round-trip: record → flush → load preserves labels identically', async () => {
    const original = new JudgmentDataset(testBasePath);
    original.record({
      evidenceId: 'round-trip-1',
      rubric: 'task_type',
      axis: 'epistemic',
      label: 'belief',
      source: 'FeedbackLearner.onCorrection',
    });
    original.record({
      evidenceId: 'round-trip-2',
      rubric: 'ambiguity',
      axis: 'epistemic',
      label: 'high',
      score: 0.8,
      source: 'FeedbackLearner.onCorrection',
    });

    await original.flush(testFile);
    const loaded = await JudgmentDataset.load(testFile);

    expect(loaded.size).toBe(original.size);
    const origLabels = original.all();
    const loadedLabels = loaded.all();
    for (let i = 0; i < origLabels.length; i++) {
      expect(loadedLabels[i]).toEqual(origLabels[i]);
    }
  });

  it('file contains no raw utterance text (only hashes + labels)', async () => {
    const dataset = new JudgmentDataset(testBasePath);
    dataset.record({
      evidenceId: 'sha256:abcdef123456', // hash only
      rubric: 'task_type',
      axis: 'epistemic',
      label: 'belief',
      source: 'FeedbackLearner.onCorrection',
    });

    await dataset.flush(testFile);
    const content = await fs.readFile(testFile, 'utf-8');

    // Should not contain any obvious raw text patterns
    expect(content).not.toContain('This is a secret');
    expect(content).not.toContain('password');
    expect(content).toContain('sha256:abcdef123456');
    expect(content).toContain('task_type');
    expect(content).toContain('belief');
  });

  it('load handles non-existent file gracefully', async () => {
    const nonExistent = join(tmpdir(), 'non-existent-dataset.jsonl');
    const dataset = await JudgmentDataset.load(nonExistent);
    expect(dataset.size).toBe(0);
  });

  it('load skips malformed lines', async () => {
    const content = [
      JSON.stringify({ evidenceId: 'good1', rubric: 'a', axis: 'epistemic', label: 'x', source: 's' }),
      'not valid json',
      JSON.stringify({ evidenceId: 'good2', rubric: 'b', axis: 'teleological', label: 'y', source: 't' }),
    ].join('\n') + '\n';

    await fs.writeFile(testFile, content, 'utf-8');
    const dataset = await JudgmentDataset.load(testFile);

    expect(dataset.size).toBe(2);
    expect(dataset.all()[0]!.evidenceId).toBe('good1');
    expect(dataset.all()[1]!.evidenceId).toBe('good2');
  });
});