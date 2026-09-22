import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ActionGateError,
  BoundaryValidationError,
  BudgetExceeded,
  BudgetGateError,
  BuilderError,
  DigestMismatch,
  GateError,
  PerceptionGateError,
  RewardGateError,
  SchemaInductionError,
  SenarsError,
} from '../../nar/src/errors/index.js';
import {
  attempt,
  err,
  flatMap,
  isErr,
  isOk,
  map,
  ok,
  unwrapOrThrow,
} from '../../nar/src/utils/result.js';
import { ConnectionConfigSchema, ToolSpecSchema } from '../../nar/src/tools/schemas.js';
import { StatePersister } from '../../nar/src/nar/persistence.js';

/** Bench 64 — Error Taxonomy & Result (TODO20 Phase 3). */

const NAR_SRC = join(import.meta.dirname, '../../nar/src');

describe('Bench 64 — Error Taxonomy (E1)', () => {
  it('every taxonomy class is a SenarsError with a grep-able code and context', () => {
    const cases: [SenarsError, string, Record<string, unknown>][] = [
      [new BuilderError('bad spec', 'wiring'), 'BUILDER_ERROR', { step: 'wiring' }],
      [
        new GateError('denied', 'perception', 'quality', 'admit'),
        'GATE_DENIED',
        { gate: 'perception', reason: 'quality', operation: 'admit' },
      ],
      [
        new BudgetExceeded('over', 'scope-1', 'derive', 100, 101),
        'BUDGET_EXCEEDED',
        { scope: 'scope-1', limit: 100, consumed: 101 },
      ],
      [
        new DigestMismatch('digest', 'aaa', 'bbb', 'snapshot'),
        'DIGEST_MISMATCH',
        { expected: 'aaa', actual: 'bbb', artifact: 'snapshot' },
      ],
      [new SchemaInductionError('boom', 'candidate-generation'), 'SCHEMA_INDUCTION', { phase: 'candidate-generation' }],
      [
        new BoundaryValidationError('bad', 'config', [{ path: ['x'], message: 'required' }]),
        'VALIDATION_ERROR',
        { path: 'config' },
      ],
    ];
    for (const [error, code, context] of cases) {
      expect(error).toBeInstanceOf(SenarsError);
      expect(error.code).toBe(code);
      expect(error.context).toMatchObject(context);
      expect(error.toJSON().code).toBe(code);
    }
  });

  it('per-gate subclasses are typed by gate', () => {
    for (const [e, gate] of [
      [new PerceptionGateError('r', 'op'), 'perception'],
      [new ActionGateError('r', 'op'), 'action'],
      [new BudgetGateError('r', 'op'), 'budget'],
      [new RewardGateError('r', 'op'), 'reward'],
    ] as [GateError, string][]) {
      expect(e.gate).toBe(gate);
      expect(e.operation).toBe('op');
      expect(e).toBeInstanceOf(GateError);
    }
  });

  it('SenarsError.wrap enriches context and preserves the cause chain', () => {
    const cause = new Error('disk on fire');
    const wrapped = SenarsError.wrap(cause, { operation: 'load', scopeId: 's1' });
    expect(wrapped).toBeInstanceOf(SenarsError);
    expect(wrapped.message).toBe('disk on fire');
    expect(wrapped.context).toMatchObject({ operation: 'load', scopeId: 's1' });
    expect(wrapped.cause).toBe(cause);

    const nested = SenarsError.wrap(wrapped, { operation: 'boot' });
    expect(nested.cause).toBe(wrapped);
    expect(nested.context).toMatchObject({ operation: 'boot', scopeId: 's1' });
  });

  it('no `catch (e: any)` remains in nar/src (E4 grep-guard)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.ts') && readFileSync(p, 'utf8').includes('catch (e: any)'))
          offenders.push(p);
      }
    };
    walk(NAR_SRC);
    expect(offenders).toEqual([]);
  });
});

describe('Bench 64 — Result (E2)', () => {
  it('ok/err constructors and type guards', () => {
    const good = ok(42);
    const bad = err(new Error('no'));
    expect(isOk(good) && good.value === 42).toBe(true);
    expect(isErr(bad) && bad.error.message === 'no').toBe(true);
  });

  it('map/flatMap short-circuit on errors', () => {
    expect(map(ok(1), (v: number) => v * 2)).toEqual(ok(2));
    const e = err(new Error('x'));
    expect(map(e, (v: number) => v * 2)).toBe(e);
    expect(flatMap(e, (v: number) => ok(v))).toBe(e);
  });

  it('unwrapOrThrow throws the carried error', () => {
    expect(unwrapOrThrow(ok('v'))).toBe('v');
    const e = new TypeError('bad');
    expect(() => unwrapOrThrow(err(e))).toThrow(e);
  });

  it('attempt captures sync throws', () => {
    expect(attempt(() => 1)).toEqual(ok(1));
    const r = attempt(() => {
      throw new Error('captured');
    });
    expect(isErr(r) && r.error.message === 'captured').toBe(true);
  });
});

describe('Bench 64 — Zod strict boundaries (E3)', () => {
  it('ToolSpecSchema rejects unknown keys', () => {
    expect(ToolSpecSchema.safeParse({ name: 't', description: 'd', inputSchema: {} }).success).toBe(true);
    const r = ToolSpecSchema.safeParse({ name: 't', description: 'd', inputSchema: {}, rogue: 1 });
    expect(r.success).toBe(false);
  });

  it('ConnectionConfigSchema rejects unknown keys', () => {
    const base = { id: 'c', enabled: true, type: 'irc', config: {} };
    expect(ConnectionConfigSchema.safeParse(base).success).toBe(true);
    expect(ConnectionConfigSchema.safeParse({ ...base, rogue: true }).success).toBe(false);
  });
});

describe('Bench 64 — Result adoption (persistence)', () => {
  it('unreadable state files yield typed errors, not ENOENT crashes', async () => {
    const persister = new StatePersister({
      config: { persistState: true, statePath: join(import.meta.dirname, 'tmp-does-not-exist') },
      memory: { addTask: () => {} } as never,
      processor: { serializeLMRules: () => ({}), deserializeLMRules: () => {} },
      attentionReport: () => ({ concepts: [], total: 0 }),
      query: { getBeliefs: () => [], getGoals: () => [], getQuestions: () => [] },
    });
    // load() must not throw on missing files (ENOENT → ok(null) path)
    await expect(persister.load()).resolves.toBeUndefined();
  });
});

// BoundaryValidationError.fromZod smoke (zod v3/v4 shape)
describe('Bench 64 — BoundaryValidationError.fromZod', () => {
  it('captures path and issues from a zod error', () => {
    const parsed = z.object({ a: z.string() }).strict().safeParse({ a: 1, rogue: 2 });
    expect(parsed.success).toBe(false);
    const validationError = BoundaryValidationError.fromZod('agent-options', parsed.error!);
    expect(validationError.path).toBe('agent-options');
    expect(validationError.issues.length).toBeGreaterThan(0);
    expect(validationError).toBeInstanceOf(SenarsError);
  });
});
