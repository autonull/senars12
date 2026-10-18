/**
 * CORE.19 C7.1 — the one-shot CLI (believe/ask/step, no browser).
 *
 * The flag reader is tested directly; the runner is tested through its printed
 * output, which is the contract a script consumes.
 */

import { parseFlags } from '@senars/util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOneShot, readOneShot, runOneShot } from '../../src/bin/lib/oneshot.js';

describe('CORE.19 C7.1 — one-shot flag reading', () => {
  it('collects every repeatable flag across its long and short spellings', () => {
    const request = readOneShot(
      parseFlags([
        '--believe',
        '(a-->b).',
        '-b',
        '(b-->c).',
        '--ask',
        '(a-->c)?',
        '-q',
        '(c-->d)?',
        '--goal',
        '(x)!',
        '--steps',
        '7',
        '--json',
      ])
    );
    expect(request).toEqual({
      beliefs: ['(a-->b).', '(b-->c).'],
      goals: ['(x)!'],
      questions: ['(a-->c)?', '(c-->d)?'],
      steps: 7,
      json: true,
    });
  });

  it('defaults steps and json, and recognises the trigger flags', () => {
    const request = readOneShot(parseFlags(['-q', '(a-->b)?']));
    expect(request.steps).toBe(10);
    expect(request.json).toBe(false);
    expect(isOneShot(parseFlags(['-q', '(a-->b)?']))).toBe(true);
    expect(isOneShot(parseFlags(['--status']))).toBe(false);
  });
});

describe('CORE.19 C7.1 — one-shot round-trip', () => {
  afterEach(() => vi.restoreAllMocks());

  it('derives an answer and cites its derivation', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    await runOneShot({
      beliefs: ['(cat-->animal).', '(animal-->living).'],
      goals: [],
      questions: ['(cat-->living)?'],
      steps: 10,
      json: false,
    });

    const output = lines.join('\n');
    expect(output).toContain('(cat-->living)? => (cat-->living)');
    expect(output).toContain('nal.deduction');
  });

  it('emits parseable JSON when asked', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    const result = await runOneShot({
      beliefs: ['(cat-->animal).', '(animal-->living).'],
      goals: [],
      questions: ['(cat-->living)?'],
      steps: 10,
      json: true,
    });

    expect(result.cycleCount).toBe(10);
    expect(result.answers[0]).toMatchObject({
      question: '(cat-->living)?',
      answer: '(cat-->living)',
    });
    expect(result.answers[0]!.derivation!.length).toBeGreaterThan(0);
    // The printed form is the JSON document, so a script can consume stdout.
    expect(lines.some((line) => line.startsWith('{'))).toBe(true);
  });
});
