import { afterEach, describe, expect, it } from 'vitest';
import {
  envBool,
  envCsv,
  envFirst,
  envInt,
  envStr,
  envStrOr,
  isTruthy,
  parseEnvValue,
} from '@senars/util/config';

const KEYS = [
  'SENARS_TEST_A',
  'SENARS_TEST_B',
  'SENARS_TEST_C',
  'ENABLE_TEST',
  'PORT_TEST',
  'CSV_TEST',
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('env truthiness', () => {
  it('accepts the documented truthy spellings, case-insensitively', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'On']) expect(isTruthy(value)).toBe(true);
    for (const value of ['false', '0', 'no', 'off', '', 'maybe', undefined]) {
      expect(isTruthy(value)).toBe(false);
    }
  });
});

describe('envInt', () => {
  it('falls back when unset or unparseable', () => {
    expect(envInt('PORT_TEST', 8765)).toBe(8765);
    process.env.PORT_TEST = 'not-a-number';
    expect(envInt('PORT_TEST', 8765)).toBe(8765);
  });

  it('parses base-10 integers', () => {
    process.env.PORT_TEST = '3000';
    expect(envInt('PORT_TEST', 8765)).toBe(3000);
  });
});

describe('envBool', () => {
  it('distinguishes unset from falsy', () => {
    expect(envBool('ENABLE_TEST')).toBe(false);
    expect(envBool('ENABLE_TEST', true)).toBe(true);
    process.env.ENABLE_TEST = 'false';
    expect(envBool('ENABLE_TEST', true)).toBe(false);
    process.env.ENABLE_TEST = '1';
    expect(envBool('ENABLE_TEST')).toBe(true);
  });
});

describe('envFirst / envStr / envStrOr', () => {
  it('resolves the first defined, non-empty alias', () => {
    expect(envFirst('SENARS_TEST_A', 'SENARS_TEST_B')).toBeUndefined();
    process.env.SENARS_TEST_B = '';
    expect(envFirst('SENARS_TEST_A', 'SENARS_TEST_B')).toBeUndefined();
    process.env.SENARS_TEST_B = 'b';
    expect(envStr('SENARS_TEST_A', 'SENARS_TEST_B')).toBe('b');
    expect(envStrOr('fallback', 'SENARS_TEST_A')).toBe('fallback');
  });
});

describe('envCsv', () => {
  it('trims entries and copies the fallback', () => {
    const fallback = ['a'];
    expect(envCsv(fallback, 'CSV_TEST')).toEqual(['a']);
    expect(envCsv(fallback, 'CSV_TEST')).not.toBe(fallback);
    process.env.CSV_TEST = 'irc-main, http-main ';
    expect(envCsv(fallback, 'CSV_TEST')).toEqual(['irc-main', 'http-main']);
  });
});

describe('parseEnvValue', () => {
  it('coerces booleans before numbers, then leaves strings alone', () => {
    expect(parseEnvValue('true')).toBe(true);
    expect(parseEnvValue('0')).toBe(false);
    expect(parseEnvValue('42')).toBe(42);
    expect(parseEnvValue('llamacpp')).toBe('llamacpp');
  });
});
