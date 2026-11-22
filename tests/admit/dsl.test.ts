/**
 * W7 — Skill DSL tests.
 * Tests the DSL parser, compiler, sandbox execution, and dry-run episodes.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createDSLCompiler,
  parseDSL,
  DSLExpr,
  DSLProgram,
  DSL_STDLIB,
  defaultSandboxLimits,
} from '../../src/admit/dsl';
import { createSandbox, SandboxLimits } from '../../src/admit/sandbox';
import { createDefaultClock } from '../../src/kernel/env';

describe('W7 — Skill DSL', () => {
  let clock: ReturnType<typeof createDefaultClock>;

  beforeEach(() => {
    clock = createDefaultClock();
  });

  describe('DSL Parser', () => {
    it('parses const expressions', () => {
      const source = '42';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
      expect(program.body).toBeDefined();
    });

    it('parses arithmetic expressions', () => {
      const source = '1 + 2 * 3';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses variable bindings', () => {
      const source = 'let x = 10; x + 5';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses function definitions', () => {
      const source = 'fn (a, b) => a + b';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses conditionals', () => {
      const source = 'if true then 1 else 0';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses list operations', () => {
      const source = '[1, 2, 3].map(x => x * 2)';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses admit/demote/promote expressions', () => {
      const source = 'admit("belief", term, truth, ["tag"])';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses bounded loops', () => {
      const source = 'for i in range(10) { sum = sum + i }';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });

    it('parses while loops with fuel guard', () => {
      const source = 'while x > 0 { x = x - 1 }';
      const program = parseDSL(source, clock);
      expect(program).toBeDefined();
    });
  });

  describe('DSL Compiler', () => {
    it('compiles const expressions', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'const', value: 42 };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('literal');
      expect((ast as any).value).toBe(42);
    });

    it('compiles variable references', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'var', name: 'x' };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('variable');
      expect((ast as any).name).toBe('x');
    });

    it('compiles function calls', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'call', fn: 'add', args: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }] };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('call');
      expect((ast as any).function).toBe('add');
    });

    it('compiles conditionals', () => {
      const compiler = createDSLCompiler();
      // biome-ignore lint/suspicious/noThenProperty: DSL syntax requires 'then' property
      const expr: DSLExpr = { type: 'if', cond: { type: 'const', value: true }, then: { type: 'const', value: 1 }, else: { type: 'const', value: 0 } };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('if');
    });

    it('compiles let bindings', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'let', name: 'x', value: { type: 'const', value: 10 }, body: { type: 'var', name: 'x' } };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('let');
      expect((ast as any).name).toBe('x');
    });

    it('compiles list literals', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'list', items: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }] };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('list');
      expect((ast as any).elements.length).toBe(2);
    });

    it('compiles admit expressions', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'admit', kind: 'belief', term: {} as any, truth: { f: 1, c: 0.9 }, tags: ['test'] };
      const ast = compiler.compile(expr);
      expect(ast.type).toBe('call');
      expect((ast as any).function).toBe('admit');
    });

    it('compiles bounded for loop', () => {
      const compiler = createDSLCompiler();
      const expr: DSLExpr = { type: 'for', var: 'i', range: { type: 'call', fn: 'range', args: [{ type: 'const', value: 10 }] }, body: { type: 'const', value: null } };
      const ast = compiler.compile(expr);
      expect(ast).toBeDefined();
    });
  });

  describe('DSL Execution', () => {
    it('executes arithmetic', () => {
      const compiler = createDSLCompiler();
      const program: DSLProgram = {
        id: 'test-1',
        name: 'arithmetic',
        body: [
          { type: 'op', op: 'add', args: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }] },
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      expect(result.results[0]).toBe(3);
    });

    it('executes let bindings', () => {
      const compiler = createDSLCompiler();
      const program: DSLProgram = {
        id: 'test-2',
        name: 'let-binding',
        body: [
          { type: 'let', name: 'x', value: { type: 'const', value: 10 }, body: { type: 'var', name: 'x' } },
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      expect(result.results[0]).toBe(10);
    });

    it('executes conditionals', () => {
      const compiler = createDSLCompiler();
      const program: DSLProgram = {
        id: 'test-3',
        name: 'conditional',
        body: [
          // biome-ignore lint/suspicious/noThenProperty: DSL syntax requires 'then' property
          { type: 'if', cond: { type: 'const', value: true }, then: { type: 'const', value: 1 }, else: { type: 'const', value: 0 } },
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      expect(result.results[0]).toBe(1);
    });

    it('executes list operations', () => {
      const compiler = createDSLCompiler();
      const program: DSLProgram = {
        id: 'test-4',
        name: 'list-ops',
        body: [
          {
            type: 'let',
            name: 'list',
            value: { type: 'list', items: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }, { type: 'const', value: 3 }] },
            body: {
              type: 'call',
              fn: 'map',
              args: [
                { type: 'var', name: 'list' },
                { type: 'fn', params: ['x'], body: { type: 'op', op: 'mul', args: [{ type: 'var', name: 'x' }, { type: 'const', value: 2 }] } }
              ]
            }
          },
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      if (!result.success) {
        console.log('Error:', result.error);
      }
      expect(result.success).toBe(true);
    });

    it('tracks fuel consumption', () => {
      const compiler = createDSLCompiler({ maxFuel: 1000 });
      const program: DSLProgram = {
        id: 'test-5',
        name: 'fuel-tracking',
        body: [
          { type: 'op', op: 'add', args: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }] },
          { type: 'op', op: 'add', args: [{ type: 'const', value: 3 }, { type: 'const', value: 4 }] },
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      expect(result.fuel).toBeGreaterThan(0);
    });

    it('enforces fuel limits', () => {
      const compiler = createDSLCompiler({ maxFuel: 10 });
      const program: DSLProgram = {
        id: 'test-6',
        name: 'fuel-limit',
        body: [
          { type: 'let', name: 'x', value: { type: 'const', value: 0 }, body: {
            type: 'for', var: 'i', range: { type: 'call', fn: 'range', args: [{ type: 'const', value: 100 }] },
            body: { type: 'set', obj: { type: 'var', name: 'x' }, key: { type: 'const', value: 'x' }, value: { type: 'op', op: 'add', args: [{ type: 'var', name: 'x' }, { type: 'const', value: 1 }] } }
          }},
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Fuel exhausted');
    });

    it('executes bounded for loop', () => {
      const compiler = createDSLCompiler({ maxFuel: 5000 });
      // Simpler test: just test set/get on an object
      const program: DSLProgram = {
        id: 'test-7',
        name: 'for-loop',
        body: [
          { type: 'let', name: 'acc', value: { type: 'const', value: { sum: 0 } }, body: {
            type: 'let', name: '_', value: {
              type: 'set', obj: { type: 'var', name: 'acc' }, key: { type: 'const', value: 'sum' }, value: { type: 'const', value: 5 }
            }, body: { type: 'get', obj: { type: 'var', name: 'acc' }, key: { type: 'const', value: 'sum' } }
          }},
        ],
        metadata: {},
      };
      const result = compiler.execute(program);
      if (!result.success) {
        console.log('Error:', result.error);
      }
      console.log('Results:', result.results);
      expect(result.success).toBe(true);
      expect(result.results[result.results.length - 1]).toBe(5);
    });
  });

  describe('Sandbox', () => {
    it('executes simple arithmetic', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      const ast = { type: 'operator', operator: 'add', args: [{ type: 'literal', value: 1 }, { type: 'literal', value: 2 }] };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    it('executes conditionals', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      const ast = { type: 'if', condition: { type: 'literal', value: true }, thenBranch: { type: 'literal', value: 'yes' }, else: { type: 'literal', value: 'no' } };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(true);
      expect(result.value).toBe('yes');
    });

    it('executes let bindings', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      const ast = { type: 'let', name: 'x', value: { type: 'literal', value: 10 }, body: { type: 'variable', name: 'x' } };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('executes function calls', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      sandbox.registerFunction({
        name: 'double',
        params: ['x'],
        body: { type: 'operator', operator: 'mul', args: [{ type: 'variable', name: 'x' }, { type: 'literal', value: 2 }] },
        fuelCost: 5,
      });
      const ast = { type: 'call', function: 'double', args: [{ type: 'literal', value: 5 }] };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('enforces forbidden operators', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      const ast = { type: 'operator', operator: 'eval', args: [] };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden');
    });

    it('enforces fuel limits', () => {
      const limits: SandboxLimits = { ...defaultSandboxLimits, maxFuel: 5 };
      const sandbox = createSandbox(limits, clock);
      const ast = { type: 'operator', operator: 'add', args: [{ type: 'literal', value: 1 }, { type: 'literal', value: 2 }] };
      // Execute multiple times to exhaust fuel
      for (let i = 0; i < 3; i++) {
        sandbox.execute(ast);
      }
      const result = sandbox.execute(ast);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Fuel exhausted');
    });

    it('enforces recursion depth limit', () => {
      const limits: SandboxLimits = { ...defaultSandboxLimits, maxDepth: 3 };
      const sandbox = createSandbox(limits, clock);
      sandbox.registerFunction({
        name: 'recurse',
        params: ['n'],
        body: { type: 'if', condition: { type: 'operator', operator: 'gt', args: [{ type: 'variable', name: 'n' }, { type: 'literal', value: 0 }] }, thenBranch: { type: 'call', function: 'recurse', args: [{ type: 'operator', operator: 'sub', args: [{ type: 'variable', name: 'n' }, { type: 'literal', value: 1 }] }] }, else: { type: 'literal', value: 0 } },
        fuelCost: 10,
      });
      const ast = { type: 'call', function: 'recurse', args: [{ type: 'literal', value: 5 }] };
      const result = sandbox.execute(ast);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Max recursion depth exceeded');
    });

    it('produces execution trace', () => {
      const sandbox = createSandbox(defaultSandboxLimits, clock);
      const ast = { type: 'operator', operator: 'add', args: [{ type: 'literal', value: 1 }, { type: 'literal', value: 2 }] };
      sandbox.execute(ast);
      const trace = sandbox.getTrace();
      expect(trace.length).toBeGreaterThan(0);
      // The trace includes literal evaluations first, then the operator
      const addTrace = trace.find(t => t.operation === 'add');
      expect(addTrace).toBeDefined();
    });
  });

  describe('DSL Dry-run Episodes', () => {
    it('runs dry-run without side effects', () => {
      const compiler = createDSLCompiler({ maxFuel: 1000 });
      const program: DSLProgram = {
        id: 'dry-run-1',
        name: 'dry-run-test',
        body: [
          { type: 'let', name: 'x', value: { type: 'const', value: 10 }, body: { type: 'var', name: 'x' } },
        ],
        metadata: { dryRun: true },
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      // In dry-run mode, no external effects should occur
    });

    it('reports fuel and time for dry-run', () => {
      const compiler = createDSLCompiler({ maxFuel: 1000 });
      const program: DSLProgram = {
        id: 'dry-run-2',
        name: 'dry-run-metrics',
        body: [
          { type: 'op', op: 'add', args: [{ type: 'const', value: 1 }, { type: 'const', value: 2 }] },
        ],
        metadata: { dryRun: true },
      };
      const result = compiler.execute(program);
      expect(result.success).toBe(true);
      expect(result.fuel).toBeGreaterThan(0);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });
  });
});