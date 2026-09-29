import { afterEach, describe, expect, it } from 'vitest';
import {
  envBool,
  envCsv,
  envFirst,
  envInt,
  envNum,
  envNumOr,
  envStr,
  envStrOr,
  isBooleanSpelling,
  isFalsy,
  isTruthy,
  parseEnvValue,
  readEnvOverrides,
  SENARS_ENV_MAP,
} from '@senars/util/config';

const KEYS = [
  'SENARS_TEST_A',
  'SENARS_TEST_B',
  'SENARS_TEST_C',
  'ENABLE_TEST',
  'PORT_TEST',
  'CSV_TEST',
  'LM_TEST_CTX',
  'LM_TEST_ALIAS',
  ...Object.keys(SENARS_ENV_MAP),
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

  it('falsiness is the exact complement, not a second guess', () => {
    for (const value of ['false', 'FALSE', '0', 'no', 'Off']) expect(isFalsy(value)).toBe(true);
    for (const value of ['true', '1', 'yes', 'on', 'maybe', '']) expect(isFalsy(value)).toBe(false);
    expect(isFalsy(undefined)).toBe(false);
  });

  it('a boolean spelling is one either half accepts, and nothing else', () => {
    for (const value of ['true', '1', 'yes', 'on', 'false', '0', 'no', 'off', 'OFF']) {
      expect(isBooleanSpelling(value)).toBe(true);
    }
    for (const value of ['', 'maybe', '2', 'truthy', undefined]) {
      expect(isBooleanSpelling(value)).toBe(false);
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

describe('envNumOr / envNum', () => {
  it('resolves the first defined, parseable alias', () => {
    expect(envNumOr('LM_TEST_CTX', 'LM_TEST_ALIAS')).toBeUndefined();
    process.env.LM_TEST_ALIAS = '4096';
    expect(envNumOr('LM_TEST_CTX', 'LM_TEST_ALIAS')).toBe(4096);
    process.env.LM_TEST_CTX = '8192';
    expect(envNumOr('LM_TEST_CTX', 'LM_TEST_ALIAS')).toBe(8192);
  });

  it('yields undefined rather than NaN for a value the consumer cannot use', () => {
    process.env.LM_TEST_CTX = 'lots';
    expect(envNumOr('LM_TEST_CTX')).toBeUndefined();
    process.env.LM_TEST_CTX = '';
    expect(envNumOr('LM_TEST_CTX')).toBeUndefined();
    process.env.LM_TEST_CTX = 'Infinity';
    expect(envNumOr('LM_TEST_CTX')).toBeUndefined();
  });

  it('keeps the fractional and zero values a cap may legitimately want', () => {
    process.env.LM_TEST_CTX = '1.5';
    expect(envNumOr('LM_TEST_CTX')).toBe(1.5);
    process.env.LM_TEST_CTX = '0';
    expect(envNumOr('LM_TEST_CTX')).toBe(0);
  });

  it('envNum is the same read with a fallback substituted', () => {
    expect(envNum('LM_TEST_CTX', 2048)).toBe(2048);
    process.env.LM_TEST_CTX = 'lots';
    expect(envNum('LM_TEST_CTX', 2048)).toBe(2048);
    process.env.LM_TEST_CTX = '0.5';
    expect(envNum('LM_TEST_CTX', 2048)).toBe(0.5);
  });
});

describe('readEnvOverrides', () => {
  it('builds the nested path each mapped var targets, not a flat key', () => {
    process.env.SENARS_LM_PROVIDER = 'mock';
    process.env.SENARS_SENARS_ENABLED = 'on';
    expect(readEnvOverrides()).toEqual({
      capabilities: { lm: { provider: 'mock' }, senars: { enabled: true } },
    });
  });

  it('omits vars that are not set, so a file value survives', () => {
    expect(readEnvOverrides()).toEqual({});
  });
});

describe('parseEnvValue', () => {
  it('coerces booleans before numbers, then leaves strings alone', () => {
    expect(parseEnvValue('true')).toBe(true);
    expect(parseEnvValue('0')).toBe(false);
    expect(parseEnvValue('42')).toBe(42);
    expect(parseEnvValue('llamacpp')).toBe('llamacpp');
  });

  it('accepts the same boolean spellings isTruthy/isFalsy do, in both directions', () => {
    for (const value of ['true', '1', 'yes', 'on', 'ON']) expect(parseEnvValue(value)).toBe(true);
    for (const value of ['false', '0', 'no', 'off', 'Off']) expect(parseEnvValue(value)).toBe(false);
  });
});
