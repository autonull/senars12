/**
 * Bench 81 — Bot command primitives.
 *
 * The `.command` surface shares one argv toolkit (`tokenize`/`flagsOf`/
 * `dispatchSub`) and one dotted-path writer. These are behavioral tests over
 * those primitives, not over the command bodies.
 */

import { describe, expect, it } from 'vitest';
import {
  coerce,
  dispatchSub,
  flagsOf,
  positiveArg,
  ratioArg,
  setPath,
  tokenize,
} from '../../src/bin/commands/args.js';

describe('Bench 81 — bot command primitives', () => {
  describe('tokenize', () => {
    it('splits on runs of whitespace and drops empties', () => {
      expect(tokenize('  a   b\tc ')).toEqual(['a', 'b', 'c']);
    });

    it('yields no tokens for an empty or whitespace-only tail', () => {
      expect(tokenize()).toEqual([]);
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   ')).toEqual([]);
    });
  });

  describe('flagsOf', () => {
    it('keeps flag values out of the positional list', () => {
      // The 4th positional of `.connect irc` is the channel list: a leaked
      // `--password` value would silently replace it.
      const f = flagsOf('irc irc.libera.chat 6697 senars-bot #a,#b --password pw');
      expect(f.positional).toEqual(['irc', 'irc.libera.chat', '6697', 'senars-bot', '#a,#b']);
      expect(f.str('--password', '')).toBe('pw');
    });

    it('accepts both --flag value and --flag=value', () => {
      expect(flagsOf('t --head groundedness').str('--head', '')).toBe('groundedness');
      expect(flagsOf('t --head=groundedness').str('--head', '')).toBe('groundedness');
    });

    it('reports valueless flags and lists without mutating positionals', () => {
      const f = flagsOf('task --explain');
      expect(f.has('--explain')).toBe(true);
      expect(f.has('--other')).toBe(false);
      expect(f.positional).toEqual(['task']);
      expect(flagsOf('x --rubrics a,b,c').list('--rubrics', [])).toEqual(['a', 'b', 'c']);
    });

    it('falls back when a flag is absent or unparseable', () => {
      const f = flagsOf('task --n abc');
      expect(f.str('--missing', 'fallback')).toBe('fallback');
      expect(f.num('--n', 7)).toBe(7);
    });
  });

  describe('setPath', () => {
    it('writes a leaf and reports success', () => {
      const cfg: Record<string, unknown> = { a: { b: 1 } };
      expect(setPath(cfg, 'a.b', 2)).toBe(true);
      expect(cfg).toEqual({ a: { b: 2 } });
    });

    it('creates a missing leaf under an existing object', () => {
      const cfg: Record<string, unknown> = { a: {} };
      expect(setPath(cfg, 'a.new', 'v')).toBe(true);
      expect(cfg).toEqual({ a: { new: 'v' } });
    });

    it('supports single-segment paths', () => {
      const cfg: Record<string, unknown> = { a: 1 };
      expect(setPath(cfg, 'b', 2)).toBe(true);
      expect(cfg).toEqual({ a: 1, b: 2 });
    });

    it('rejects a path whose parent is missing or a leaf value', () => {
      const cfg: Record<string, unknown> = { a: 'string' };
      expect(setPath(cfg, 'a.b.c', 1)).toBe(false);
      expect(setPath(cfg, 'missing.leaf', 1)).toBe(false);
      expect(cfg).toEqual({ a: 'string' });
    });
  });

  describe('coerce', () => {
    it('maps the documented literals and falls through to numbers or strings', () => {
      expect(coerce('true')).toBe(true);
      expect(coerce('false')).toBe(false);
      expect(coerce('null')).toBeNull();
      expect(coerce('42')).toBe(42);
      expect(coerce('-1.5')).toBe(-1.5);
      expect(coerce('model-x')).toBe('model-x');
      expect(coerce('')).toBe('');
    });
  });

  describe('dispatchSub', () => {
    const table = {
      status: () => 'the status',
      on: () => 'switched on',
      sample: (rest: string[]) => `sample ${rest.join('|')}`,
    };
    const options = { defaults: ['status'], usage: 'Usage: table' } as const;

    it('resolves a bare invocation to the first default verb', () => {
      expect(dispatchSub('', table, options)).toBe('the status');
      expect(dispatchSub('   ', table, options)).toBe('the status');
    });

    it('dispatches an explicit verb, case-insensitively', () => {
      expect(dispatchSub('on', table, options)).toBe('switched on');
      expect(dispatchSub('STATUS', table, options)).toBe('the status');
    });

    it('passes the remaining tokens to the handler', () => {
      expect(dispatchSub('sample 0.5 extra', table, options)).toBe('sample 0.5|extra');
    });

    it('falls through to usage for an unknown verb or no default', () => {
      expect(dispatchSub('bogus', table, options)).toBe('Usage: table');
      expect(dispatchSub('', table, { usage: 'Usage: none' })).toBe('Usage: none');
    });
  });

  describe('numeric guards', () => {
    it('accepts ratios in [0,1] and rejects the rest', () => {
      expect(ratioArg('0', 'Rate')).toEqual({ value: 0 });
      expect(ratioArg('1', 'Rate')).toEqual({ value: 1 });
      expect(ratioArg('0.42', 'Rate')).toEqual({ value: 0.42 });
      expect(ratioArg('-0.1', 'Rate')).toEqual({ error: 'Rate must be 0-1' });
      expect(ratioArg('1.1', 'Rate')).toEqual({ error: 'Rate must be 0-1' });
      expect(ratioArg('abc', 'Rate')).toEqual({ error: 'Rate must be 0-1' });
    });

    it('accepts positive integers and rejects the rest', () => {
      expect(positiveArg('3', 'Budget')).toEqual({ value: 3 });
      expect(positiveArg('0', 'Budget')).toEqual({ error: 'Budget must be a positive number' });
      expect(positiveArg('x', 'Budget')).toEqual({ error: 'Budget must be a positive number' });
    });
  });
});
