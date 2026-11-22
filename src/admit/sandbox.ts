/**
 * Sandbox — fuel-metered execution environment for DSL and artifacts.
 *
 * The DSL is fuel-metered and has no dangerous words; no effect
 * bypasses admitted operators.
 */

import type { Term } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';
import type { Clock, TimestampMs } from '../kernel/env';
import { createDefaultClock } from '../kernel/env';

/** Sandbox fuel. */
export interface Fuel {
  /** Remaining fuel. */
  remaining: number;
  /** Total allocated. */
  total: number;
  /** Consumed. */
  consumed: number;
}

/** Sandbox limits. */
export interface SandboxLimits {
  /** Max fuel per execution. */
  maxFuel: number;
  /** Max recursion depth. */
  maxDepth: number;
  /** Max memory (bytes). */
  maxMemory: number;
  /** Max execution time (ms). */
  maxTimeMs: number;
  /** Allowed operators. */
  allowedOperators: string[];
  /** Forbidden operators. */
  forbiddenOperators: string[];
}

/** Default sandbox limits. */
export const defaultSandboxLimits: SandboxLimits = {
  maxFuel: 10000,
  maxDepth: 100,
  maxMemory: 1024 * 1024, // 1MB
  maxTimeMs: 5000,
  allowedOperators: [
    'add', 'sub', 'mul', 'div', 'mod',
    'lt', 'gt', 'lte', 'gte', 'eq', 'neq',
    'and', 'or', 'not',
    'if', 'let', 'lambda', 'apply',
    'list', 'head', 'tail', 'map', 'filter', 'reduce',
    'get', 'set', 'has', 'keys', 'values',
    'print', 'assert',
  ],
  forbiddenOperators: [
    'eval', 'exec', 'import', 'require', 'fetch',
    'readFile', 'writeFile', 'spawn', 'exit',
    'setTimeout', 'setInterval', 'process', 'global',
  ],
};

/** Sandbox execution context. */
export interface SandboxContext {
  /** Variables. */
  variables: Map<string, unknown>;
  /** Functions. */
  functions: Map<string, SandboxFunction>;
  /** Fuel. */
  fuel: Fuel;
  /** Limits. */
  limits: SandboxLimits;
  /** Call stack depth. */
  depth: number;
  /** Start time. */
  startTime: number;
}

/** Runtime lambda object (evaluated from a lambda AST). */
export interface RuntimeLambda {
  params: string[];
  body: SandboxAST;
}

/** Sandbox function. */
export interface SandboxFunction {
  /** Function name. */
  name: string;
  /** Parameters. */
  params: string[];
  /** Body (AST). */
  body: SandboxAST;
  /** Fuel cost. */
  fuelCost: number;
}

/** Sandbox AST node. */
export type SandboxAST =
  | { type: 'literal'; value: unknown }
  | { type: 'variable'; name: string }
  | { type: 'call'; function: string; args: SandboxAST[] }
  | { type: 'operator'; operator: string; args: SandboxAST[] }
  | { type: 'if'; condition: SandboxAST; thenBranch: SandboxAST; else?: SandboxAST }
  | { type: 'let'; name: string; value: SandboxAST; body: SandboxAST }
  | { type: 'lambda'; params: string[]; body: SandboxAST }
  | { type: 'list'; elements: SandboxAST[] }
  | { type: 'get'; object: SandboxAST; key: SandboxAST }
  | { type: 'set'; object: SandboxAST; key: SandboxAST; value: SandboxAST }
  | { type: 'print'; value: SandboxAST };

/** Sandbox execution result. */
export interface SandboxResult {
  /** Success. */
  success: boolean;
  /** Return value. */
  value?: unknown;
  /** Error message. */
  error?: string;
  /** Fuel consumed. */
  fuelConsumed: number;
  /** Time taken (ms). */
  timeMs: number;
  /** Execution trace. */
  trace: SandboxTraceEntry[];
}

/** Sandbox trace entry. */
export interface SandboxTraceEntry {
  /** Step number. */
  step: number;
  /** Operation. */
  operation: string;
  /** Fuel before. */
  fuelBefore: number;
  /** Fuel after. */
  fuelAfter: number;
  /** Stack depth. */
  depth: number;
  /** Timestamp. */
  timestamp: number;
}

/** Sandbox — fuel-metered interpreter. */
export class Sandbox {
  private limits: SandboxLimits;
  private context: SandboxContext;
  private trace: SandboxTraceEntry[] = [];
  private stepCounter = 0;
  private clock: Clock;

  constructor(limits: Partial<SandboxLimits> = {}, clock?: Clock) {
    this.limits = { ...defaultSandboxLimits, ...limits };
    this.clock = clock ?? createDefaultClock();
    this.context = this.createContext();
  }

  /** Create initial context. */
  private createContext(): SandboxContext {
    return {
      variables: new Map(),
      functions: new Map(),
      fuel: { remaining: this.limits.maxFuel, total: this.limits.maxFuel, consumed: 0 },
      limits: this.limits,
      depth: 0,
      startTime: this.clock.now(),
    };
  }

  /** Reset sandbox. */
  reset(): void {
    const oldFunctions = this.context.functions;
    this.context = this.createContext();
    this.context.functions = oldFunctions;
    this.trace = [];
    this.stepCounter = 0;
  }

  /** Set variable. */
  setVariable(name: string, value: unknown): void {
    this.context.variables.set(name, value);
  }

  /** Get variable. */
  getVariable(name: string): unknown {
    return this.context.variables.get(name);
  }

  /** Register function. */
  registerFunction(fn: SandboxFunction): void {
    if (this.limits.forbiddenOperators.includes(fn.name)) {
      throw new Error(`Function ${fn.name} is forbidden`);
    }
    this.context.functions.set(fn.name, fn);
  }

  /** Execute AST. */
  execute(ast: SandboxAST): SandboxResult {
    this.reset();
    const startTime = this.clock.now();

    try {
      const value = this.eval(ast);
      const timeMs = this.clock.now() - startTime;
      return {
        success: true,
        value,
        fuelConsumed: this.context.fuel.consumed,
        timeMs,
        trace: this.trace,
      };
    } catch (error) {
      const timeMs = this.clock.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fuelConsumed: this.context.fuel.consumed,
        timeMs,
        trace: this.trace,
      };
    }
  }

  /** Evaluate AST node. */
  private eval(node: SandboxAST): unknown {
    this.checkLimits();

    switch (node.type) {
      case 'literal':
        return this.consumeFuel(1, 'literal', node.value);

      case 'variable':
        return this.consumeFuel(1, 'variable', this.context.variables.get(node.name));

      case 'call':
        return this.evalCall(node);

      case 'operator':
        return this.evalOperator(node);

      case 'if':
        return this.evalIf(node);

      case 'let':
        return this.evalLet(node);

      case 'lambda':
        return this.consumeFuel(5, 'lambda', {
          params: node.params,
          body: node.body,
        });

      case 'list':
        return this.consumeFuel(2, 'list', node.elements.map(e => this.eval(e)));

      case 'get':
        return this.evalGet(node);

      case 'set':
        return this.evalSet(node);

      case 'print':
        this.evalPrint(node);
        return undefined;

      default:
        throw new Error(`Unknown AST node type: ${(node as any).type}`);
    }
  }

  /** Evaluate function call. */
  private evalCall(node: { type: 'call'; function: string; args: SandboxAST[] }): unknown {
    const fn = this.context.functions.get(node.function);
    if (!fn) {
      throw new Error(`Function not found: ${node.function}`);
    }

    this.checkFuel(fn.fuelCost);
    this.context.depth++;
    if (this.context.depth > this.limits.maxDepth) {
      throw new Error('Max recursion depth exceeded');
    }

    let result: unknown;

    // Special built-in implementations that need unevaluated args
    switch (node.function) {
      case 'internal_range': {
        const n = this.eval(node.args[0]!) as number;
        result = Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i);
        break;
      }
      case 'internal_for_impl': {
        const varName = this.eval(node.args[0]!) as string;
        const range = this.eval(node.args[1]!) as unknown[];
        const body = node.args[2]!; // Pass unevaluated AST
        const maxIterations = this.eval(node.args[3]!) as number;
        result = this.evalForLoop(varName, range, body, maxIterations);
        break;
      }
      case 'internal_while_impl': {
        const cond = node.args[0]!; // Pass unevaluated AST
        const body = node.args[1]!; // Pass unevaluated AST
        const maxIterations = this.eval(node.args[2]!) as number;
        result = this.evalWhileLoop(cond, body, maxIterations);
        break;
      }
      case 'internal_map': {
        const list = this.eval(node.args[0]!) as unknown[];
        const fn = this.eval(node.args[1]!) as RuntimeLambda; // Evaluated lambda object
        result = list.map(item => this.applyLambda(fn, [item]));
        break;
      }
      case 'internal_filter': {
        const list = this.eval(node.args[0]!) as unknown[];
        const fn = this.eval(node.args[1]!) as RuntimeLambda; // Evaluated lambda object
        result = list.filter(item => this.applyLambda(fn, [item]) as boolean);
        break;
      }
      case 'internal_reduce': {
        const list = this.eval(node.args[0]!) as unknown[];
        const fn = this.eval(node.args[1]!) as RuntimeLambda; // Evaluated lambda object
        const init = this.eval(node.args[2]!);
        let acc = init;
        for (const item of list) {
          acc = this.applyLambda(fn, [acc, item]);
        }
        result = acc;
        break;
      }
      case 'internal_head': {
        const list = this.eval(node.args[0]!) as unknown[];
        result = list[0];
        break;
      }
      case 'internal_tail': {
        const list = this.eval(node.args[0]!) as unknown[];
        result = list.slice(1);
        break;
      }
      default: {
        // Evaluate args for user-defined functions
        const args = node.args.map(arg => this.eval(arg));
        // Execute user-defined function body with parameter bindings
        const prevVars = new Map<string, unknown>();
        for (let i = 0; i < fn.params.length; i++) {
          const param = fn.params[i]!;
          const prev = this.context.variables.get(param);
          prevVars.set(param, prev);
          this.context.variables.set(param, args[i]);
        }
        result = this.eval(fn.body);
        // Restore previous variable values
        for (const [param, prev] of prevVars) {
          if (prev === undefined) {
            this.context.variables.delete(param);
          } else {
            this.context.variables.set(param, prev);
          }
        }
        break;
      }
    }

    this.context.depth--;

    return this.consumeFuel(fn.fuelCost, `call:${node.function}`, result);
  }

  /** Evaluate for loop. */
  private evalForLoop(varName: string, range: unknown[], body: SandboxAST, maxIterations: number): unknown {
    let result: unknown = undefined;
    const iterations = Math.min(range.length, maxIterations);

    for (let i = 0; i < iterations; i++) {
      this.checkLimits();
      const prev = this.context.variables.get(varName);
      this.context.variables.set(varName, range[i]!);
      result = this.eval(body);
      if (prev === undefined) {
        this.context.variables.delete(varName);
      } else {
        this.context.variables.set(varName, prev);
      }
    }
    return result;
  }

  /** Type guard for runtime lambda object. */
  private isRuntimeLambda(value: unknown): value is RuntimeLambda {
    return typeof value === 'object' && value !== null && 'params' in value && 'body' in value &&
      Array.isArray((value as RuntimeLambda).params) && typeof (value as RuntimeLambda).body === 'object';
  }

  /** Evaluate while loop. */
  private evalWhileLoop(cond: SandboxAST, body: SandboxAST, maxIterations: number): unknown {
    let result: unknown = undefined;
    let iterations = 0;

    while (iterations < maxIterations) {
      this.checkLimits();
      const condition = this.eval(cond);
      if (!condition) break;
      result = this.eval(body);
      iterations++;
    }
    return result;
  }

  /** Apply a lambda (AST or evaluated lambda object) with arguments. */
  private applyLambda(lambda: RuntimeLambda | SandboxAST, args: unknown[]): unknown {
    let lambdaObj: { params: string[]; body: SandboxAST };
    if (this.isRuntimeLambda(lambda)) {
      lambdaObj = lambda;
    } else {
      const ast = lambda as SandboxAST;
      if (ast.type !== 'lambda') {
        throw new Error('Expected lambda AST node');
      }
      lambdaObj = { params: ast.params, body: ast.body };
    }
    const prevVars = new Map<string, unknown>();
    for (let i = 0; i < lambdaObj.params.length; i++) {
      const param = lambdaObj.params[i]!;
      const prev = this.context.variables.get(param);
      prevVars.set(param, prev);
      this.context.variables.set(param, args[i]);
    }
    const result = this.eval(lambdaObj.body);
    for (const [param, prev] of prevVars) {
      if (prev === undefined) {
        this.context.variables.delete(param);
      } else {
        this.context.variables.set(param, prev);
      }
    }
    return result;
  }

  /** Evaluate operator. */
  private evalOperator(node: { type: 'operator'; operator: string; args: SandboxAST[] }): unknown {
    if (this.limits.forbiddenOperators.includes(node.operator)) {
      throw new Error(`Operator forbidden: ${node.operator}`);
    }
    if (!this.limits.allowedOperators.includes(node.operator)) {
      throw new Error(`Operator not allowed: ${node.operator}`);
    }

    this.checkFuel(2);
    const args = node.args.map(arg => this.eval(arg));

    // Simple operator evaluation
    switch (node.operator) {
      case 'add': return this.consumeFuel(2, 'add', (args[0] as number) + (args[1] as number));
      case 'sub': return this.consumeFuel(2, 'sub', (args[0] as number) - (args[1] as number));
      case 'mul': return this.consumeFuel(2, 'mul', (args[0] as number) * (args[1] as number));
      case 'div': return this.consumeFuel(2, 'div', (args[0] as number) / (args[1] as number));
      case 'mod': return this.consumeFuel(2, 'mod', (args[0] as number) % (args[1] as number));
      case 'lt': return this.consumeFuel(1, 'lt', (args[0] as number) < (args[1] as number));
      case 'gt': return this.consumeFuel(1, 'gt', (args[0] as number) > (args[1] as number));
      case 'lte': return this.consumeFuel(1, 'lte', (args[0] as number) <= (args[1] as number));
      case 'gte': return this.consumeFuel(1, 'gte', (args[0] as number) >= (args[1] as number));
      case 'eq': return this.consumeFuel(1, 'eq', args[0] === args[1]);
      case 'neq': return this.consumeFuel(1, 'neq', args[0] !== args[1]);
      case 'and': return this.consumeFuel(1, 'and', args[0] && args[1]);
      case 'or': return this.consumeFuel(1, 'or', args[0] || args[1]);
      case 'not': return this.consumeFuel(1, 'not', !args[0]);
      default: throw new Error(`Operator not implemented: ${node.operator}`);
    }
  }

  /** Evaluate if. */
  private evalIf(node: { type: 'if'; condition: SandboxAST; thenBranch: SandboxAST; else?: SandboxAST }): unknown {
    this.checkFuel(1);
    const condition = this.eval(node.condition);
    if (condition) {
      return this.eval(node.thenBranch);
    } else if (node.else) {
      return this.eval(node.else);
    }
    return undefined;
  }

  /** Evaluate let. */
  private evalLet(node: { type: 'let'; name: string; value: SandboxAST; body: SandboxAST }): unknown {
    this.checkFuel(1);
    const value = this.eval(node.value);
    const prev = this.context.variables.get(node.name);
    this.context.variables.set(node.name, value);
    const result = this.eval(node.body);
    if (prev === undefined) {
      this.context.variables.delete(node.name);
    } else {
      this.context.variables.set(node.name, prev);
    }
    return result;
  }

  /** Evaluate get. */
  private evalGet(node: { type: 'get'; object: SandboxAST; key: SandboxAST }): unknown {
    this.checkFuel(1);
    const obj = this.eval(node.object);
    const key = this.eval(node.key);
    if (obj && typeof obj === 'object' && key !== undefined) {
      return this.consumeFuel(1, 'get', (obj as Record<string, unknown>)[String(key)]);
    }
    return undefined;
  }

  /** Evaluate set. */
  private evalSet(node: { type: 'set'; object: SandboxAST; key: SandboxAST; value: SandboxAST }): unknown {
    this.checkFuel(2);
    const obj = this.eval(node.object);
    const key = this.eval(node.key);
    const value = this.eval(node.value);
    if (obj && typeof obj === 'object' && key !== undefined) {
      (obj as Record<string, unknown>)[String(key)] = value;
    }
    return value;
  }

  /** Evaluate print. */
  private evalPrint(node: { type: 'print'; value: SandboxAST }): void {
    this.checkFuel(1);
    const value = this.eval(node.value);
    console.log('[Sandbox]', value);
  }

  /** Check fuel and limits. */
  private checkLimits(): void {
    const elapsed = this.clock.now() - this.context.startTime;
    if (elapsed > this.limits.maxTimeMs) {
      throw new Error('Execution time limit exceeded');
    }
    if (this.context.fuel.remaining <= 0) {
      throw new Error('Fuel exhausted');
    }
  }

  /** Consume fuel. */
  private checkFuel(amount: number): void {
    if (this.context.fuel.remaining < amount) {
      throw new Error('Fuel exhausted');
    }
    this.context.fuel.remaining -= amount;
    this.context.fuel.consumed += amount;
  }

  /** Consume fuel and return value. */
  private consumeFuel<T>(amount: number, operation: string, value: T): T {
    const fuelBefore = this.context.fuel.remaining;
    this.checkFuel(amount);
    this.stepCounter++;
    this.trace.push({
      step: this.stepCounter,
      operation,
      fuelBefore,
      fuelAfter: this.context.fuel.remaining,
      depth: this.context.depth,
      timestamp: this.clock.now(),
    });
    return value;
  }

  /** Get current fuel. */
  getFuel(): Fuel {
    return { ...this.context.fuel };
  }

  /** Get trace. */
  getTrace(): SandboxTraceEntry[] {
    return [...this.trace];
  }
}

/** Create a sandbox. */
export function createSandbox(limits?: SandboxLimits, clock?: Clock): Sandbox {
  return new Sandbox(limits, clock);
}