/**
 * Faculty Engine — executes faculty invocations through the oracle seam.
 */

import { createHash } from 'crypto';
import type { FacultySpec, FacultyInput, FacultyOutput, FacultyRegistry, FacultyOracleMeta } from './specs.js';
import { createFacultyRegistry } from './specs.js';
import type { Clock, IDGenerator } from '../kernel/env.js';
import { DeterministicClock, DeterministicIDGenerator, DeterministicRNG } from '../kernel/env.js';
import type { Oracle, OracleInput, OracleOutput, OracleRegistry } from '../oracles/oracle.js';
import { createOracleRegistry, createStandardOracleRegistry } from '../oracles/oracle.js';
import { OraclePinStore } from '../oracles/pins.js';
import type { ILMService } from '../lm/interfaces.js';

/** Faculty engine configuration. */
export interface FacultyEngineConfig {
  /** Faculty registry to use (isolated by default). */
  registry?: FacultyRegistry;
  /** Oracle registry to use (isolated by default). */
  oracles?: OracleRegistry;
  /** LM service for standard oracle registry (if not providing custom oracles). */
  lmService?: ILMService | null;
  /** Clock (deterministic clock by default). */
  clock?: Clock;
  /** ID generator (deterministic by default). */
  ids?: IDGenerator;
  /** Pin store for deterministic replay. */
  pinStore?: OraclePinStore;
  /** Default timeout for faculty calls. */
  defaultTimeoutMs?: number;
  /** Whether to enable fallback on oracle failure. */
  enableFallback?: boolean;
  /** Whether to emit telemetry. */
  telemetry?: boolean;
}

/** Faculty invocation context. */
export interface FacultyInvocationContext {
  /** Unique invocation ID. */
  invocationId: string;
  /** Faculty being invoked. */
  faculty: string;
  /** Input to the faculty. */
  input: FacultyInput;
  /** Start timestamp. */
  startTs: number;
  /** Oracle call metadata. */
  oracleMeta?: FacultyOracleMeta;
}



/** Faculty engine statistics. */
export interface FacultyEngineStats {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  fallbackInvocations: number;
  pinnedInvocations: number;
  totalDurationMs: number;
  byFaculty: Record<string, {
    calls: number;
    successes: number;
    fallbacks: number;
    avgDurationMs: number;
  }>;
}

/** Faculty engine. */
export class FacultyEngine {
  private registry: FacultyRegistry;
  private oracles: OracleRegistry;
  private clock: Clock;
  private ids: IDGenerator;
  private pinStore: OraclePinStore | null;
  private defaultTimeoutMs: number;
  private enableFallback: boolean;
  private telemetry: boolean;
  private isReplay = false;

  private stats: FacultyEngineStats = {
    totalInvocations: 0,
    successfulInvocations: 0,
    failedInvocations: 0,
    fallbackInvocations: 0,
    pinnedInvocations: 0,
    totalDurationMs: 0,
    byFaculty: {},
  };

  private telemetryCallbacks: Array<(context: FacultyInvocationContext, output: FacultyOutput) => void> = [];

  constructor(config: FacultyEngineConfig = {}) {
    this.registry = config.registry ?? createFacultyRegistry();
    this.oracles = config.oracles ?? createStandardOracleRegistry(config.lmService as any, config.pinStore);
    this.clock = config.clock ?? new DeterministicClock();
    this.ids = config.ids ?? new DeterministicIDGenerator(new DeterministicRNG());
    this.pinStore = config.pinStore ?? null;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30000;
    this.enableFallback = config.enableFallback ?? true;
    this.telemetry = config.telemetry ?? true;
  }

  /** Set the pin store. */
  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  /** Enable/disable replay mode. */
  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  /** Add a telemetry callback. */
  onTelemetry(callback: (context: FacultyInvocationContext, output: FacultyOutput) => void): void {
    this.telemetryCallbacks.push(callback);
  }

  /** Invoke a faculty. */
  async invoke<T = unknown>(input: FacultyInput): Promise<FacultyOutput<T>> {
    const invocationId = this.ids.uuid();
    const startTs = this.clock.now();
    const facultyName = input.faculty;

    const spec = this.registry.get(facultyName);
    if (!spec) {
      throw new Error(`Faculty ${facultyName} not registered`);
    }

    if (!spec.enabled) {
      throw new Error(`Faculty ${facultyName} is disabled`);
    }

    const context: FacultyInvocationContext = {
      invocationId,
      faculty: facultyName,
      input,
      startTs,
    };

    this.stats.totalInvocations++;
    this.initFacultyStats(facultyName);
    const facultyStats = this.stats.byFaculty[facultyName]!;
    facultyStats.calls++;

    let output: FacultyOutput<T>;
    let fallbackUsed = false;

    try {
      // Build oracle input first (needed for pinning)
      const oracleInput = this.buildOracleInput(input, spec);

      // Check pin store first if in replay mode
      if (this.isReplay && this.pinStore) {
        const pinned = await this.pinStore.getPin(spec.oracleOperation, oracleInput.args);
        if (pinned !== null) {
          this.stats.pinnedInvocations++;
          this.stats.successfulInvocations++;
          facultyStats.successes++;
          output = pinned as FacultyOutput<T>;
          output.fallbackUsed = false;
          this.emitTelemetry(context, output);
          return output;
        }
      }

      // Invoke through oracle
      output = await this.invokeThroughOracle<T>(input, spec, context, oracleInput);
      this.stats.successfulInvocations++;
      facultyStats.successes++;

      // Pin the result if not in replay mode
      if (!this.isReplay && this.pinStore) {
        const inputHash = this.pinStore.hashInput(spec.oracleOperation, oracleInput.args);
        await this.pinStore.pin(spec.oracleOperation, inputHash, output);
      }
    } catch (error) {
      this.stats.failedInvocations++;
      facultyStats.calls--; // Don't count failed as call for avg

      if (this.enableFallback && spec.fallback) {
        // Try fallback
        this.stats.fallbackInvocations++;
        facultyStats.fallbacks++;

        try {
          const fallbackOutput = await spec.fallback(input);
          if (fallbackOutput) {
            output = {
              ...fallbackOutput,
              fallbackUsed: true,
              faculty: facultyName,
            } as FacultyOutput<T>;
            this.stats.successfulInvocations++; // Fallback success counts as success
            facultyStats.successes++;
          } else {
            throw error;
          }
        } catch (fallbackError) {
          throw error; // Throw original error
        }
      } else {
        throw error;
      }
    } finally {
      const durationMs = this.clock.now() - startTs;
      this.stats.totalDurationMs += durationMs;
      this.updateFacultyAvgDuration(facultyName, durationMs);
    }

    output.fallbackUsed = fallbackUsed;
    this.emitTelemetry(context, output);
    return output;
  }

  /** Invoke a faculty through the oracle. */
  private async invokeThroughOracle<T>(
    input: FacultyInput,
    spec: FacultySpec,
    context: FacultyInvocationContext,
    oracleInput: OracleInput
  ): Promise<FacultyOutput<T>> {
    const oracle = this.oracles.get(spec.oracleOperation);
    if (!oracle) {
      throw new Error(`No oracle registered for ${spec.oracleOperation}`);
    }

    const oracleOutput = await oracle.call(oracleInput);

    // Parse oracle output into faculty output
    const facultyOutput = this.parseOracleOutput<T>(oracleOutput, spec, oracleInput.args);

    // Attach oracle metadata
    facultyOutput.oracleMeta = {
      operation: spec.oracleOperation,
      callId: oracleOutput.meta.callId,
      provider: oracleOutput.meta.provider,
      pinned: oracleOutput.meta.pinned,
      durationMs: oracleOutput.meta.durationMs,
    };

    return facultyOutput;
  }

  /** Build oracle input from faculty input. */
  private buildOracleInput(input: FacultyInput, spec: FacultySpec): OracleInput {
    const { primary, secondary, context } = input;

    switch (spec.oracleOperation) {
      case 'lm.generateText': {
        const prompt = this.buildPrompt(input, spec);
        return {
          operation: 'lm.generateText',
          args: [prompt, { task: 'quality', temperature: 0.3 }],
        };
      }
      case 'lm.generateObject': {
        const prompt = this.buildPrompt(input, spec);
        // Schema would be derived from spec.outputSchema
        return {
          operation: 'lm.generateObject',
          args: [prompt, {}, { task: 'structured', temperature: 0.3 }],
        };
      }
      case 'retrieval.query': {
        const query = primary.toString();
        return {
          operation: 'retrieval.query',
          args: [query, { topK: context?.maxResults ?? 10, threshold: context?.confidenceThreshold ?? 0.7 }],
        };
      }
      case 'engine.z3': {
        const script = this.buildZ3Script(input, spec);
        return {
          operation: 'engine.z3',
          args: [script, { timeoutMs: spec.timeoutMs }],
        };
      }
      case 'engine.clingo': {
        const program = this.buildClingoProgram(input, spec);
        return {
          operation: 'engine.clingo',
          args: [program, { timeoutMs: spec.timeoutMs, format: 'json' }],
        };
      }
      case 'engine.tau-prolog': {
        const program = this.buildPrologProgram(input, spec);
        const query = this.buildPrologQuery(input, spec);
        return {
          operation: 'engine.tau-prolog',
          args: [program, query, { timeoutMs: spec.timeoutMs, maxSolutions: 10 }],
        };
      }
      case 'formalization.nlToFormal': {
        const text = primary.toString();
        const ctx = context as any;
        return {
          operation: 'formalization.nlToFormal',
          args: [text, ctx],
        };
      }
      case 'formalization.formalToNl': {
        const genInput = context?.metadata?.generationInput as any ?? { term: primary.toString(), direction: 'to-natural' };
        return {
          operation: 'formalization.formalToNl',
          args: [genInput],
        };
      }
      default:
        throw new Error(`Unsupported oracle operation: ${spec.oracleOperation}`);
    }
  }

  /** Build prompt for LM oracles. */
  private buildPrompt(input: FacultyInput, spec: FacultySpec): string {
    const { primary, secondary, context } = input;
    const primaryStr = primary.toString();
    const secondaryStr = secondary?.toString() ?? '';

    // Faculty-specific prompt templates
    const templates: Record<string, string> = {
      grounding: `Find concrete referents for: ${primaryStr}`,
      abduction: `Generate hypotheses explaining: ${primaryStr}`,
      induction: `Induce general pattern from: ${primaryStr} with examples: ${secondaryStr}`,
      analogy: `Find analogies between: ${primaryStr} and ${secondaryStr}`,
      evaluation: `Evaluate outcome: ${primaryStr} against goal: ${secondaryStr}`,
      communication: context?.metadata?.direction === 'to-natural'
        ? `Translate to natural language: ${primaryStr}`
        : `Translate to Narsese: ${primaryStr}`,
      planning: `Decompose goal into plan: ${primaryStr}`,
    };

    return templates[spec.name] ?? `Process: ${primaryStr}`;
  }

  /** Build Z3 script. */
  private buildZ3Script(input: FacultyInput, spec: FacultySpec): string {
    // Simplified - would generate proper SMT-LIB based on faculty
    return `(set-logic QF_UF)\n(assert true)\n(check-sat)\n(get-model)`;
  }

  /** Build Clingo program. */
  private buildClingoProgram(input: FacultyInput, spec: FacultySpec): string {
    // Simplified - would generate proper ASP based on faculty
    return `plan(1..10).\n:- not goal.`;
  }

  /** Build Prolog program. */
  private buildPrologProgram(input: FacultyInput, spec: FacultySpec): string {
    // Simplified - would generate proper Prolog based on faculty
    return `parent(john, mary).\nparent(mary, ann).\nancestor(X, Y) :- parent(X, Y).\nancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).`;
  }

  /** Build Prolog query. */
  private buildPrologQuery(input: FacultyInput, spec: FacultySpec): string {
    return `ancestor(john, ann).`;
  }

  /** Parse oracle output into faculty output. */
  private parseOracleOutput<T>(
    oracleOutput: OracleOutput,
    spec: FacultySpec,
    oracleArgs: unknown[]
  ): FacultyOutput<T> {
    // This would be faculty-specific parsing
    // For now, return a basic structure
    return {
      faculty: spec.name,
      result: oracleOutput.value as T,
      confidence: 0.8,
      evidence: [{
        source: 'oracle',
        description: `Oracle ${spec.oracleOperation} result`,
        strength: 0.8,
        oracleCallId: oracleOutput.meta.callId,
      }],
      fallbackUsed: false,
      durationMs: oracleOutput.meta.durationMs,
    };
  }

  /** Hash faculty input for pinning. */
  private hashInput(input: FacultyInput): string {
    const json = JSON.stringify({
      faculty: input.faculty,
      primary: input.primary?.toString(),
      secondary: input.secondary?.toString(),
      context: input.context,
    }, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  /** Initialize faculty stats. */
  private initFacultyStats(faculty: string): void {
    if (!this.stats.byFaculty[faculty]) {
      this.stats.byFaculty[faculty] = {
        calls: 0,
        successes: 0,
        fallbacks: 0,
        avgDurationMs: 0,
      };
    }
  }

  /** Update faculty average duration. */
  private updateFacultyAvgDuration(faculty: string, durationMs: number): void {
    const fs = this.stats.byFaculty[faculty];
    if (fs) {
      fs.avgDurationMs = (fs.avgDurationMs * (fs.calls - 1) + durationMs) / fs.calls;
    }
  }

  /** Emit telemetry. */
  private emitTelemetry(context: FacultyInvocationContext, output: FacultyOutput): void {
    if (!this.telemetry) return;
    for (const callback of this.telemetryCallbacks) {
      try {
        callback(context, output);
      } catch {
        // Ignore telemetry errors
      }
    }
  }

  /** Get engine statistics. */
  getStats(): FacultyEngineStats {
    return { ...this.stats };
  }

  /** Get available faculties. */
  getAvailableFaculties(): FacultySpec[] {
    return this.registry.getEnabled();
  }

  /** Check if a faculty is available. */
  hasFaculty(name: string): boolean {
    return this.registry.has(name as any);
  }
}

/** Create a faculty engine. */
export function createFacultyEngine(config?: FacultyEngineConfig): FacultyEngine {
  return new FacultyEngine(config);
}

/** Global faculty engine instance. */
export const facultyEngine = createFacultyEngine();

/** Convenience function to invoke a faculty. */
export async function invokeFaculty<T = unknown>(input: FacultyInput): Promise<FacultyOutput<T>> {
  return facultyEngine.invoke<T>(input);
}