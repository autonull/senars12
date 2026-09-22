import {
  atom,
  type Budget,
  ConfigurationError,
  createBudget,
  createTask,
  DEFAULT_CONFIG,
  err,
  isErr,
  isOk,
  NARError,
  ok,
  OperationError,
  Truth,
  unwrapOrThrow,
  ValidationError,
  flatMap,
  map,
} from '@senars/nar';
import type { ErrorCode } from '@senars/util/errors';

describe('Budget', () => {
  describe.each`
    priority | durability | quality | cycles | depth
    ${0.8}   | ${0.9}     | ${0.7}  | ${5}   | ${3}
    ${0.5}   | ${0.8}     | ${0.9}  | ${0}   | ${0}
    ${1.0}   | ${1.0}     | ${1.0}  | ${10}  | ${5}
    ${0.0}   | ${0.0}     | ${0.0}  | ${0}   | ${0}
  `(
    'createBudget with priority=$priority, durability=$durability, quality=$quality',
    ({ priority, durability, quality, cycles, depth }) => {
      test('creates frozen budget with correct values', () => {
        const budget = createBudget(priority, durability, quality, cycles, depth);
        expect(budget.priority).toBeCloseTo(priority);
        expect(budget.durability).toBeCloseTo(durability);
        expect(budget.quality).toBeCloseTo(quality);
        expect(budget.cycles).toBe(cycles);
        expect(budget.depth).toBe(depth);
        expect(Object.isFrozen(budget)).toBe(true);
      });
    }
  );

  test('createBudget uses defaults when only priority provided', () => {
    const budget = createBudget(0.5);
    expect(budget.priority).toBe(0.5);
    expect(budget.durability).toBe(0.8);
    expect(budget.quality).toBe(0.9);
    expect(budget.cycles).toBe(0);
    expect(budget.depth).toBe(0);
  });

  test('createBudget handles edge cases', () => {
    const edgeCases = [
      { priority: -0.5, expected: -0.5 },
      { priority: 1.5, expected: 1.5 },
      { priority: Number.NaN, expected: Number.NaN },
    ];

    edgeCases.forEach(({ priority, expected }) => {
      const budget = createBudget(priority);
      expect(budget.priority).toBe(expected);
    });
  });
});

describe('Task', () => {
  describe.each`
    type          | truth
    ${'belief'}   | ${Truth.create(0.9, 0.8)}
    ${'goal'}     | ${Truth.NEUTRAL}
    ${'question'} | ${Truth.NEUTRAL}
  `('createTask with type=$type', ({ type, truth }) => {
    test('creates task with correct properties', () => {
      const term = atom('test');
      const task = createTask(term, type, truth);

      expect(task.term).toBe(term);
      expect(task.type).toBe(type);
      expect(task.truth).toEqual(truth);
      expect(task.derived).toBe(false);
      expect(task.stamp.id).toBeDefined();
      expect(task.occurrenceTime).toBeDefined();
    });
  });

  test('createTask accepts custom budget', () => {
    const term = atom('test');
    const budget: Budget = createBudget(0.7);
    const task = createTask(term, 'goal', Truth.NEUTRAL, budget);

    expect(task.budget).toBe(budget);
    expect(task.budget.priority).toBe(0.7);
  });

  test('createTask always creates non-derived task by default', () => {
    const term = atom('test');
    const task = createTask(term, 'belief', Truth.TRUE);
    expect(task.derived).toBe(false);
  });
});

describe('Result types', () => {
  describe.each`
    value
    ${42}
    ${null}
    ${true}
  `('ok with value=$value', ({ value }) => {
    test('creates ok result', () => {
      const result = ok(value);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(value);
      expect((result as { error?: undefined }).error).toBeUndefined();
    });
  });

  test('ok with object uses reference equality', () => {
    const obj = { key: 'value' };
    const result = ok(obj);
    expect(result.value).toBe(obj);
  });

  describe.each`
    error
    ${new Error('test')}
    ${new TypeError('type error')}
    ${new SyntaxError('syntax error')}
  `('err with error', ({ error }) => {
    test('creates err result', () => {
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
      expect((result as { value?: undefined }).value).toBeUndefined();
    });
  });

  test.each`
    result              | expected
    ${ok(1)}            | ${true}
    ${err(new Error())} | ${false}
    ${ok('test')}       | ${true}
    ${err(new TypeError())} | ${false}
  `('isOk/isErr detection', ({ result, expected }) => {
    expect(isOk(result)).toBe(expected);
    expect(isErr(result)).toBe(!expected);
  });

  test('map transforms ok values and passes err through', () => {
    expect(map(ok(1), (v: number) => v + 1)).toEqual(ok(2));
    const e = err(new Error('nope'));
    expect(map(e, (v: number) => v + 1)).toBe(e);
  });

  test('flatMap chains fallible operations', () => {
    expect(flatMap(ok(2), (v: number) => ok(v * 2))).toEqual(ok(4));
    const e = err(new Error('stop'));
    expect(flatMap(ok(2), () => e)).toBe(e);
  });

  test('unwrapOrThrow throws the carried error', () => {
    expect(unwrapOrThrow(ok(7))).toBe(7);
    const e = new Error('boom');
    expect(() => unwrapOrThrow(err(e))).toThrow(e);
  });
});

describe('Error types', () => {
  describe.each`
    ErrorClass            | message         | code
    ${NARError}           | ${'msg'}        | ${'CODE'}
    ${ValidationError}    | ${'invalid'}    | ${'VALIDATION_ERROR'}
    ${ConfigurationError} | ${'bad config'} | ${'CONFIGURATION_ERROR'}
    ${OperationError}     | ${'failed'}     | ${'OPERATION_ERROR'}
  `('$ErrorClass.name', ({ ErrorClass, message, code }) => {
    test('creates error with correct properties', () => {
      const err = new ErrorClass(message, code as any);

      expect(err.name).toBe(ErrorClass.name);
      expect(err.code).toBe(code);
      expect(err.message).toBe(message);
    });
  });

  test('NARError accepts optional context', () => {
    const context = { key: 'val' };
    const err = new NARError('test', 'VALIDATION_ERROR', context);
    expect(err.context).toEqual(context);
  });

  test('NARError supports custom error codes', () => {
    const customCodes = ['CUSTOM_CODE', 'ANOTHER_CODE', 'TEST_123'];

    customCodes.forEach((code) => {
      const err = new NARError('test', code as ErrorCode);
      expect(err.code).toBe(code);
    });
  });
});

describe('DEFAULT_CONFIG', () => {
  const configTests = [
    { key: 'maxConcepts', expected: 1000 },
    { key: 'activationDecayRate', expected: 0.01 },
    { key: 'consolidationInterval', expected: 10 },
    { key: 'cpuThrottleMs', expected: 10 },
    { key: 'maxDerivationDepth', expected: 10 },
    { key: 'maxDerivationsPerStep', expected: 1000 },
  ] as const;

  test.each(configTests)('has $key = $expected', ({ key, expected }) => {
    expect(DEFAULT_CONFIG[key]).toBe(expected);
  });

  test('is frozen to prevent modification', () => {
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
  });

  test('config values are within valid ranges', () => {
    expect(DEFAULT_CONFIG.activationDecayRate).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.maxConcepts).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.consolidationInterval).toBeGreaterThan(0);
  });
});
