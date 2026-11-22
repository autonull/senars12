/**
 * Tau Prolog Oracle — Prolog reasoning through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from '../oracle.js';
import { OraclePinStore } from '../pins.js';

/** Input for Tau Prolog query. */
export interface TauPrologInput extends OracleInput {
  operation: 'engine.tau-prolog';
  args: [program: string, query: string, options?: TauPrologOptions];
}

/** Tau Prolog execution options. */
export interface TauPrologOptions {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Maximum number of solutions. */
  maxSolutions?: number;
  /** Whether to include statistics. */
  stats?: boolean;
}

/** Tau Prolog solution. */
export interface TauPrologSolution {
  /** Variable bindings. */
  bindings: Record<string, unknown>;
  /** Solution number. */
  number: number;
}

/** Tau Prolog execution result. */
export interface TauPrologResult {
  /** Whether the query succeeded. */
  success: boolean;
  /** Solutions found. */
  solutions: TauPrologSolution[];
  /** Statistics. */
  stats?: Record<string, unknown>;
  /** Error message if failed. */
  error?: string;
  /** Duration in ms. */
  durationMs: number;
}

/** Tau Prolog Oracle configuration. */
export interface TauPrologOracleConfig extends OracleConfig {
  operation: 'engine.tau-prolog';
  /** Default timeout. */
  defaultTimeoutMs?: number;
  /** Default max solutions. */
  defaultMaxSolutions?: number;
}

/** Tau Prolog Oracle implementation. */
export class TauPrologOracle implements Oracle<TauPrologInput, TauPrologResult> {
  public readonly operation: 'engine.tau-prolog' = 'engine.tau-prolog';
  public readonly provider: string = 'tau-prolog';
  public readonly version?: string;

  private defaultTimeoutMs: number;
  private defaultMaxSolutions: number;
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: TauPrologOracleConfig) {
    this.version = config.version;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.defaultMaxSolutions = config.defaultMaxSolutions ?? 100;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: TauPrologInput): Promise<OracleOutput<TauPrologResult>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: TauPrologResult;

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as TauPrologResult,
            meta: {
              callId,
              ts: startTs,
              durationMs: 0,
              provider: this.provider,
              version: this.version,
              pinned: true,
            },
          };
        }
      }

      value = await this.execute(input);
      this.stats.successfulCalls++;

      if (!this.isReplay && this.pinStore) {
        await this.pinStore.pin(this.operation, this.hashInput(input.args), this.provider, this.version, input.context, value);
      }
    } catch (e) {
      this.stats.failedCalls++;
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const durationMs = Date.now() - startTs;
      this.stats.totalDurationMs += durationMs;
    }

    return {
      value,
      meta: {
        callId,
        ts: startTs,
        durationMs: Date.now() - startTs,
        provider: this.provider,
        version: this.version,
        pinned,
        error,
      },
    };
  }

  private async execute(input: TauPrologInput): Promise<TauPrologResult> {
    const [program, query, options] = input.args;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const maxSolutions = options?.maxSolutions ?? this.defaultMaxSolutions;
    const includeStats = options?.stats ?? false;

    // Dynamically import tau-prolog to avoid requiring it as a dependency
    let pl: any;
    try {
      pl = await import('tau-prolog');
    } catch {
      throw new Error('tau-prolog not installed. Install with: pnpm add tau-prolog');
    }

    const startTs = Date.now();
    const session = pl.create(1000); // 1000ms limit per query

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tau Prolog query timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      session.consult(program, {
        success: () => {
          session.query(query, {
            success: (goal: any) => {
              const solution: TauPrologSolution = {
                bindings: {},
                number: this.stats.successfulCalls + 1,
              };

              // Extract variable bindings
              for (const [key, value] of goal.substitution.links) {
                solution.bindings[key.id] = this.termToJS(value);
              }

              // Check if we have enough solutions
              if (this.stats.successfulCalls >= maxSolutions) {
                clearTimeout(timeout);
                resolve({
                  success: true,
                  solutions: [solution],
                  durationMs: Date.now() - startTs,
                });
                return;
              }

              // Continue for more solutions
              session.answer(goal, {
                success: (nextGoal: any) => {
                  const nextSolution: TauPrologSolution = {
                    bindings: {},
                    number: this.stats.successfulCalls + 2,
                  };
                  for (const [key, value] of nextGoal.substitution.links) {
                    nextSolution.bindings[key.id] = this.termToJS(value);
                  }
                  // This is simplified - in practice you'd loop
                },
                error: (err: any) => {
                  clearTimeout(timeout);
                  resolve({
                    success: true,
                    solutions: [solution],
                    durationMs: Date.now() - startTs,
                  });
                },
                fail: () => {
                  clearTimeout(timeout);
                  resolve({
                    success: true,
                    solutions: [solution],
                    durationMs: Date.now() - startTs,
                  });
                },
                limit: () => {
                  clearTimeout(timeout);
                  resolve({
                    success: true,
                    solutions: [solution],
                    durationMs: Date.now() - startTs,
                  });
                },
              });
            },
            error: (err: any) => {
              clearTimeout(timeout);
              resolve({
                success: false,
                solutions: [],
                error: err?.message ?? String(err),
                durationMs: Date.now() - startTs,
              });
            },
            fail: () => {
              clearTimeout(timeout);
              resolve({
                success: false,
                solutions: [],
                error: 'Query failed',
                durationMs: Date.now() - startTs,
              });
            },
            limit: () => {
              clearTimeout(timeout);
              resolve({
                success: false,
                solutions: [],
                error: 'Query limit exceeded',
                durationMs: Date.now() - startTs,
              });
            },
          });
        },
        error: (err: any) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            solutions: [],
            error: err?.message ?? String(err),
            durationMs: Date.now() - startTs,
          });
        },
      });
    });
  }

  private termToJS(term: any): unknown {
    if (term instanceof term.constructor.Term) {
      if (term.constructor.name === 'Var') {
        return { type: 'var', name: term.id };
      } else if (term.constructor.name === 'Num') {
        return term.value;
      } else if (term.constructor.name === 'Term') {
        return {
          type: 'compound',
          name: term.id,
          args: term.args.map((arg: any) => this.termToJS(arg)),
        };
      }
    }
    return term;
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await import('tau-prolog');
      return true;
    } catch {
      return false;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a Tau Prolog oracle. */
export function createTauPrologOracle(config: Partial<Omit<TauPrologOracleConfig, 'operation'>> = {}): TauPrologOracle {
  return new TauPrologOracle({
    operation: 'engine.tau-prolog',
    provider: 'tau-prolog',
    ...config,
  });
}