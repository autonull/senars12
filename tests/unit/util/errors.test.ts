import {
  ConfigError,
  ConfigurationError,
  ConnectionError,
  EngineError,
  type ErrorCode,
  OperationError,
  PolicyViolation,
  SenarsError,
  ToolError,
  ValidationError,
} from '@senars/util/errors';
import { describe, expect, it } from 'vitest';

describe('SenarsError base', () => {
  it('carries message, code, and context', () => {
    const ctx = { foo: 'bar' };
    const err = new SenarsError('boom', 'TIMEOUT', ctx);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SenarsError);
    expect(err.message).toBe('boom');
    expect(err.code).toBe('TIMEOUT');
    expect(err.context).toEqual(ctx);
    expect(err.name).toBe('SenarsError');
  });

  it('preserves cause via ErrorOptions', () => {
    const cause = new Error('root');
    const err = new SenarsError('boom', 'PARSE_ERROR', undefined, { cause });
    expect(err.cause).toBe(cause);
  });

  it('tolerates missing context', () => {
    const err = new SenarsError('boom', 'LOOP_DETECTED');
    expect(err.context).toBeUndefined();
  });
});

describe('error subclasses', () => {
  const cases: Array<
    [new (m: string, c?: Record<string, unknown>) => SenarsError, ErrorCode, string]
  > = [
    [ToolError, 'TOOL_ERROR', 'ToolError'],
    [EngineError, 'ENGINE_ERROR', 'EngineError'],
    [ConfigError, 'CONFIG_ERROR', 'ConfigError'],
    [TransportErrorProbe, 'TRANSPORT_ERROR', 'TransportError'],
    [ConnectionError, 'CONNECTION_ERROR', 'ConnectionError'],
    [ValidationError, 'VALIDATION_ERROR', 'ValidationError'],
    [ConfigurationError, 'CONFIGURATION_ERROR', 'ConfigurationError'],
    [OperationError, 'OPERATION_ERROR', 'OperationError'],
  ];

  for (const [Ctor, code, name] of cases) {
    it(`${name} extends SenarsError with code ${code}`, () => {
      const err = new Ctor('fail', { detail: 1 });
      expect(err).toBeInstanceOf(SenarsError);
      expect(err).toBeInstanceOf(Ctor);
      expect(err.code).toBe(code);
      expect(err.name).toBe(name);
      expect(err.context).toEqual({ detail: 1 });
    });
  }
});

import { TransportError } from '@senars/util/errors';
class TransportErrorProbe extends TransportError {}

describe('PolicyViolation', () => {
  it('encodes command in context and reason as message', () => {
    const err = new PolicyViolation('rm -rf', 'not allowed');
    expect(err).toBeInstanceOf(SenarsError);
    expect(err.code).toBe('POLICY_VIOLATION');
    expect(err.message).toBe('not allowed');
    expect(err.context).toEqual({ command: 'rm -rf' });
    expect(err.name).toBe('PolicyViolation');
  });
});

describe('error-code union', () => {
  it('all subclass codes are valid ErrorCode members', () => {
    const codes: ErrorCode[] = [
      new ToolError('x').code,
      new EngineError('x').code,
      new ConfigError('x').code,
      new TransportError('x').code,
      new ConnectionError('x').code,
      new ValidationError('x').code,
      new ConfigurationError('x').code,
      new OperationError('x').code,
      new PolicyViolation('x', 'y').code,
    ];
    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });
});
