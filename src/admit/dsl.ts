/**
 * DSL — domain-specific language for artifact manipulation.
 *
 * The DSL is strictly more expressive than composition and needs no sandbox.
 * It is fuel-metered and has no dangerous words.
 */

import type { Term } from '../kernel/terms/term.js';
import type { TruthValue } from '../kernel/truth.js';
import type { SandboxAST, SandboxFunction, SandboxLimits, Sandbox } from './sandbox.js';
import { createSandbox } from './sandbox.js';

/** DSL expression. */
export type DSLExpr =
  | { type: 'const'; value: unknown }
  | { type: 'var'; name: string }
  | { type: 'call'; fn: string; args: DSLExpr[] }
  | { type: 'op'; op: string; args: DSLExpr[] }
  | { type: 'if'; cond: DSLExpr; then: DSLExpr; else?: DSLExpr }
  | { type: 'let'; name: string; value: DSLExpr; body: DSLExpr }
  | { type: 'fn'; params: string[]; body: DSLExpr }
  | { type: 'list'; items: DSLExpr[] }
  | { type: 'get'; obj: DSLExpr; key: DSLExpr }
  | { type: 'set'; obj: DSLExpr; key: DSLExpr; value: DSLExpr }
  | { type: 'artifact'; id: string }
  | { type: 'admit'; kind: string; term: Term; truth: TruthValue; tags?: string[] }
  | { type: 'demote'; id: string; reason: string }
  | { type: 'promote'; id: string; reason: string }
  | { type: 'query'; pattern: DSLExpr; filter?: DSLExpr }
  | { type: 'compose'; items: DSLExpr[] }
  | { type: 'match'; value: DSLExpr; cases: { pattern: DSLExpr; body: DSLExpr }[] };

/** DSL program. */
export interface DSLProgram {
  /** Program ID. */
  id: string;
  /** Name. */
  name: string;
  /** Expressions. */
  body: DSLExpr[];
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** DSL compiler. */
export class DSLCompiler {
  private sandbox: Sandbox;
  private functions: Map<string, SandboxFunction> = new Map();

  constructor(limits?: SandboxLimits) {
    this.sandbox = createSandbox(limits);
    this.registerBuiltins();
  }

  /** Register built-in functions. */
  private registerBuiltins(): void {
    const builtins: SandboxFunction[] = [
      {
        name: 'admit',
        params: ['kind', 'term', 'truth', 'tags'],
        body: { type: 'call', function: 'internal_admit', args: [] },
        fuelCost: 10,
      },
      {
        name: 'demote',
        params: ['id', 'reason'],
        body: { type: 'call', function: 'internal_demote', args: [] },
        fuelCost: 5,
      },
      {
        name: 'promote',
        params: ['id', 'reason'],
        body: { type: 'call', function: 'internal_promote', args: [] },
        fuelCost: 5,
      },
      {
        name: 'query',
        params: ['pattern', 'filter'],
        body: { type: 'call', function: 'internal_query', args: [] },
        fuelCost: 20,
      },
      {
        name: 'compose',
        params: ['items'],
        body: { type: 'call', function: 'internal_compose', args: [] },
        fuelCost: 15,
      },
    ];

    for (const fn of builtins) {
      this.functions.set(fn.name, fn);
      this.sandbox.registerFunction(fn);
    }
  }

  /** Compile DSL expression to sandbox AST. */
  compile(expr: DSLExpr): SandboxAST {
    switch (expr.type) {
      case 'const':
        return { type: 'literal', value: expr.value };
      case 'var':
        return { type: 'variable', name: expr.name };
      case 'call':
        return {
          type: 'call',
          function: expr.fn,
          args: expr.args.map(arg => this.compile(arg)),
        };
      case 'op':
        return {
          type: 'operator',
          operator: expr.op,
          args: expr.args.map(arg => this.compile(arg)),
        };
      case 'if':
        return {
          type: 'if',
          condition: this.compile(expr.cond),
          then: this.compile(expr.then),
          else: expr.else ? this.compile(expr.else) : undefined,
        };
      case 'let':
        return {
          type: 'let',
          name: expr.name,
          value: this.compile(expr.value),
          body: this.compile(expr.body),
        };
      case 'fn':
        return {
          type: 'lambda',
          params: expr.params,
          body: this.compile(expr.body),
        };
      case 'list':
        return {
          type: 'list',
          elements: expr.items.map(item => this.compile(item)),
        };
      case 'get':
        return {
          type: 'get',
          object: this.compile(expr.obj),
          key: this.compile(expr.key),
        };
      case 'set':
        return {
          type: 'set',
          object: this.compile(expr.obj),
          key: this.compile(expr.key),
          value: this.compile(expr.value),
        };
      case 'artifact':
        return { type: 'literal', value: { __artifact: expr.id } };
      case 'admit':
        return {
          type: 'call',
          function: 'admit',
          args: [
            { type: 'literal', value: expr.kind },
            { type: 'literal', value: expr.term },
            { type: 'literal', value: expr.truth },
            { type: 'literal', value: expr.tags ?? [] },
          ],
        };
      case 'demote':
        return {
          type: 'call',
          function: 'demote',
          args: [
            { type: 'literal', value: expr.id },
            { type: 'literal', value: expr.reason },
          ],
        };
      case 'promote':
        return {
          type: 'call',
          function: 'promote',
          args: [
            { type: 'literal', value: expr.id },
            { type: 'literal', value: expr.reason },
          ],
        };
      case 'query':
        return {
          type: 'call',
          function: 'query',
          args: [
            this.compile(expr.pattern),
            expr.filter ? this.compile(expr.filter) : { type: 'literal', value: null },
          ],
        };
      case 'compose':
        return {
          type: 'call',
          function: 'compose',
          args: [
            { type: 'list', elements: expr.items.map(item => this.compile(item)) },
          ],
        };
      case 'match':
        return {
          type: 'call',
          function: 'match',
          args: [
            this.compile(expr.value),
            { type: 'literal', value: expr.cases.map(c => ({ pattern: this.compile(c.pattern), body: this.compile(c.body) })) },
          ],
        };
    }
  }

  /** Compile program. */
  compileProgram(program: DSLProgram): SandboxAST[] {
    return program.body.map(expr => this.compile(expr));
  }

  /** Execute DSL program. */
  execute(program: DSLProgram): { results: unknown[]; fuel: number; timeMs: number } {
    const compiled = this.compileProgram(program);
    const results: unknown[] = [];
    let totalFuel = 0;
    let totalTime = 0;

    for (const ast of compiled) {
      const result = this.sandbox.execute(ast);
      results.push(result.value);
      totalFuel += result.fuelConsumed;
      totalTime += result.timeMs;
      if (!result.success) {
        break;
      }
    }

    return { results, fuel: totalFuel, timeMs: totalTime };
  }

  /** Get sandbox for direct access. */
  getSandbox(): Sandbox {
    return this.sandbox;
  }
}

/** Create a DSL compiler. */
export function createDSLCompiler(limits?: SandboxLimits): DSLCompiler {
  return new DSLCompiler(limits);
}

/** Parse DSL from string (simplified). */
export function parseDSL(source: string): DSLProgram {
  // In a real implementation, use a proper parser (e.g., peggy)
  // This is a placeholder that returns an empty program
  return {
    id: `dsl-${Date.now()}`,
    name: 'parsed',
    body: [],
    metadata: { source },
  };
}

/** DSL standard library. */
export const DSL_STDLIB = {
  /** Arithmetic. */
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  div: (a: number, b: number) => a / b,
  mod: (a: number, b: number) => a % b,

  /** Comparison. */
  lt: (a: number, b: number) => a < b,
  gt: (a: number, b: number) => a > b,
  lte: (a: number, b: number) => a <= b,
  gte: (a: number, b: number) => a >= b,
  eq: (a: unknown, b: unknown) => a === b,
  neq: (a: unknown, b: unknown) => a !== b,

  /** Logical. */
  and: (a: boolean, b: boolean) => a && b,
  or: (a: boolean, b: boolean) => a || b,
  not: (a: boolean) => !a,

  /** List operations. */
  list: (...items: unknown[]) => items,
  head: <T>(list: T[]) => list[0],
  tail: <T>(list: T[]) => list.slice(1),
  map: <T, U>(list: T[], fn: (x: T) => U) => list.map(fn),
  filter: <T>(list: T[], fn: (x: T) => boolean) => list.filter(fn),
  reduce: <T, U>(list: T[], fn: (acc: U, x: T) => U, init: U) => list.reduce(fn, init),

  /** Object operations. */
  get: <T>(obj: Record<string, T>, key: string) => obj[key],
  set: <T>(obj: Record<string, T>, key: string, value: T) => { obj[key] = value; return obj; },
  has: <T>(obj: Record<string, T>, key: string) => key in obj,
  keys: <T>(obj: Record<string, T>) => Object.keys(obj),
  values: <T>(obj: Record<string, T>) => Object.values(obj),

  /** Control flow. */
  if: <T>(cond: boolean, then: T, else_: T) => cond ? then : else_,

  /** Print. */
  print: (...args: unknown[]) => console.log(...args),
};