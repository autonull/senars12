import { describe, expect, it } from 'vitest';
import { dispatchCommand, registerCommand } from '../../src/client/core/commands.js';

describe('dispatchCommand', () => {
  it('runs a registered command and reports success', () => {
    let runs = 0;
    registerCommand({
      id: 'test.run',
      title: 'Run',
      group: 'Test',
      run: () => {
        runs += 1;
      },
    });
    expect(dispatchCommand('test.run')).toBe(true);
    expect(runs).toBe(1);
  });

  it('reports false for an unknown command', () => {
    expect(dispatchCommand('nope.nope')).toBe(false);
  });

  it('does not run an unavailable command', () => {
    let ran = false;
    registerCommand({
      id: 'test.when',
      title: 'Conditional',
      group: 'Test',
      run: () => {
        ran = true;
      },
      available: () => false,
    });
    expect(dispatchCommand('test.when')).toBe(false);
    expect(ran).toBe(false);
  });

  it('passes args through parse to run', () => {
    const seen: unknown[] = [];
    registerCommand({
      id: 'test.args',
      title: 'Args',
      group: 'Test',
      parse: (args) => ({ ref: String(args.ref) }),
      run: (args) => seen.push(args?.ref),
    });
    expect(dispatchCommand('test.args', { ref: 7 })).toBe(true);
    expect(seen).toEqual(['7']);
  });

  it('reports false and does not run when parse rejects', () => {
    let ran = false;
    registerCommand({
      id: 'test.reject',
      title: 'Reject',
      group: 'Test',
      parse: () => {
        throw new Error('bad args');
      },
      run: () => {
        ran = true;
      },
    });
    expect(dispatchCommand('test.reject', {})).toBe(false);
    expect(ran).toBe(false);
  });
});
