/**
 * CORE.19 C7.1 — the one-shot CLI.
 *
 * Input is positional Narsese: punctuation is the task type, and one argument
 * may hold several sentences, so there is no `-b`/`-g`/`-q` to get wrong.
 */

import { parseFlags } from '@senars/util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOneShot, readOneShot, runOneShot } from '../../src/bin/lib/oneshot.js';

describe('CORE.19 C7.1 — one-shot input reading', () => {
  it('reads positional sentences and splits several tasks in one argument', () => {
    const request = readOneShot(
      parseFlags(['(a-->b). (a-->c)?', '(g)!', '--steps', '7', '--json'])
    );
    expect(request).toEqual({
      inputs: ['(a-->b).', '(a-->c)?', '(g)!'],
      steps: 7,
      json: true,
    });
  });

  it('defaults steps and json, and triggers on positional input only', () => {
    const request = readOneShot(parseFlags(['(a-->b)?']));
    expect(request.steps).toBe(10);
    expect(request.json).toBe(false);
    expect(isOneShot(parseFlags(['(a-->b)?']))).toBe(true);
    expect(isOneShot(parseFlags(['--status']))).toBe(false);
  });

  it('skips the pnpm `--` separator that leaks into argv', () => {
    expect(readOneShot(parseFlags(['--', '(a-->b). (a-->c)?', '--steps', '3']))).toEqual({
      inputs: ['(a-->b).', '(a-->c)?'],
      steps: 3,
      json: false,
    });
  });
});

describe('CORE.19 C7.1 — one-shot round-trip', () => {
  afterEach(() => vi.restoreAllMocks());

  it('infers the task type from punctuation and answers the question', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    const result = await runOneShot({
      inputs: ['(cat-->animal).', '(animal-->living).', '(cat-->living)?'],
      steps: 10,
      json: false,
    });

    const output = lines.join('\n');
    expect(output).toContain('(cat-->living)? => (cat-->living)');
    expect(output).toContain('nal.deduction');
    expect(result.answers.map((a) => a.question)).toEqual(['(cat-->living)?']);
  });

  it('treats a goal as a goal and a bare sentence as a belief', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    // No question, so no answers; the goal and the bare belief both admit.
    const result = await runOneShot({
      inputs: ['(cat-->animal)', '(cat-->pet)!'],
      steps: 3,
      json: true,
    });

    expect(result.answers).toEqual([]);
    expect(result.cycleCount).toBe(3);
  });
});
