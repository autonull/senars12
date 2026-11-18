/**
 * LM Oracle — wraps LM service calls through the oracle seam.
 *
 * This is the bridge between the existing nar/src/lm/service/LMService
 * and the new oracle framework.
 */

import { createHash } from 'crypto';
import type { LMTask, LMGenerateOptions } from '@senars/utils';
import { generateText, generateObject, streamText, type LanguageModel } from 'ai';
import { zodSchema } from 'ai';
import type { ZodSchema } from 'zod';
import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from './oracle.js';
import { OraclePinStore } from './pins.js';

/** Input for LM generateText. */
export interface LMGenerateTextInput extends OracleInput {
  operation: 'lm.generateText';
  args: [prompt: string, options?: LMGenerateOptions];
}

/** Input for LM generateObject. */
export interface LMGenerateObjectInput extends OracleInput {
  operation: 'lm.generateObject';
  args: [prompt: string, schema: ZodSchema<unknown>, options?: LMGenerateOptions];
}

/** Input for LM stream. */
export interface LMStreamInput extends OracleInput {
  operation: 'lm.stream';
  args: [prompt: string, options?: Pick<LMGenerateOptions, 'task' | 'signal'>];
}

/** LM Oracle configuration. */
export interface LMOracleConfig extends OracleConfig {
  operation: 'lm.generateText' | 'lm.generateObject' | 'lm.stream';
  /** The LM service to delegate to. */
  lmService: LMOracleService;
  /** Default task if not specified. */
  defaultTask?: LMTask;
  /** Maximum output tokens. */
  maxOutputTokens?: number;
  /** Default temperature. */
  temperature?: number;
}

/**
 * Minimal interface for the LM service that the oracle needs.
 * This decouples the oracle from the concrete LMService implementation.
 */
export interface LMOracleService {
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly available: boolean;

  getModel(task: LMTask, modelOverride?: string): LanguageModel | undefined;
  hasModel(): boolean;
  getStats(): { totalTokens: number };
}

/** LM Oracle implementation. */
export class LMOracle implements Oracle<LMGenerateTextInput | LMGenerateObjectInput | LMStreamInput, string | object | AsyncIterable<string>> {
  public readonly operation: 'lm.generateText' | 'lm.generateObject' | 'lm.stream';
  public readonly provider: string;
  public readonly version?: string;

  private lmService: LMOracleService;
  private defaultTask: LMTask;
  private maxOutputTokens?: number;
  private temperature?: number;
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
    totalTokens: 0,
  };

  constructor(config: LMOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.lmService = config.lmService;
    this.defaultTask = config.defaultTask ?? 'fast';
    this.maxOutputTokens = config.maxOutputTokens;
    this.temperature = config.temperature;
  }

  /** Set the pin store for deterministic replay. */
  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  /** Enable/disable replay mode. */
  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(input: LMGenerateTextInput | LMGenerateObjectInput | LMStreamInput): Promise<OracleOutput<string | object | AsyncIterable<string>>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: string | object | AsyncIterable<string>;

    this.stats.totalCalls++;

    try {
      // Check pin store first if in replay mode
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as string | object | AsyncIterable<string>,
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

      // Pin the result if not in replay mode
      if (!this.isReplay && this.pinStore) {
        await this.pinStore.pin(this.operation, this.hashInput(input.args), value);
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
        tokens: this.extractTokens(value),
      },
    };
  }

  private async execute(input: LMGenerateTextInput | LMGenerateObjectInput | LMStreamInput): Promise<string | object | AsyncIterable<string>> {
    const [prompt, options] = input.args;

    switch (this.operation) {
      case 'lm.generateText': {
        const opts = options as LMGenerateOptions | undefined;
        const task = opts?.task ?? this.defaultTask;
        const model = this.lmService.getModel(task, opts?.model);
        if (!model) {
          throw new Error(`No model available for task: ${task}`);
        }

        const { text, usage } = await generateText({
          model,
          prompt,
          abortSignal: opts?.signal,
          temperature: opts?.temperature ?? this.temperature,
          maxOutputTokens: opts?.maxOutputTokens ?? this.maxOutputTokens,
        });

        if (usage && typeof (usage as { totalTokens?: number }).totalTokens === 'number') {
          this.stats.totalTokens += (usage as { totalTokens: number }).totalTokens;
        }

        return text;
      }

      case 'lm.generateObject': {
        const [_prompt, schema, opts] = input.args as [string, ZodSchema<unknown>, LMGenerateOptions | undefined];
        const task = opts?.task ?? 'structured';
        const model = this.lmService.getModel(task, opts?.model);
        if (!model) {
          throw new Error(`No model available for task: ${task}`);
        }

        const { object, usage } = await generateObject({
          model,
          prompt,
          schema: zodSchema(schema),
          temperature: opts?.temperature,
          abortSignal: opts?.signal,
        });

        if (usage && typeof (usage as { totalTokens?: number }).totalTokens === 'number') {
          this.stats.totalTokens += (usage as { totalTokens: number }).totalTokens;
        }

        return object as object;
      }

      case 'lm.stream': {
        const [_prompt, opts] = input.args as [string, Pick<LMGenerateOptions, 'task' | 'signal'> | undefined];
        const task = opts?.task ?? this.defaultTask;
        const model = this.lmService.getModel(task);
        if (!model) {
          throw new Error(`No model available for task: ${task}`);
        }

        const result = streamText({ model, prompt, abortSignal: opts?.signal });
        return result.textStream;
      }

      default:
        throw new Error(`Unknown LM operation: ${this.operation}`);
    }
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  private extractTokens(value: string | object | AsyncIterable<string>): { prompt: number; completion: number; total: number } | undefined {
    // Token extraction would require access to usage from the AI SDK
    // This is a placeholder - actual implementation would track usage
    return undefined;
  }

  async isAvailable(): Promise<boolean> {
    return this.lmService.hasModel();
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create an LM oracle for generateText. */
export function createLMGenerateTextOracle(
  lmService: LMOracleService,
  config: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>> = {}
): LMOracle {
  return new LMOracle({
    operation: 'lm.generateText',
    provider: lmService.provider ?? 'unknown',
    version: lmService.model,
    lmService,
    ...config,
  });
}

/** Create an LM oracle for generateObject. */
export function createLMGenerateObjectOracle(
  lmService: LMOracleService,
  config: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>> = {}
): LMOracle {
  return new LMOracle({
    operation: 'lm.generateObject',
    provider: lmService.provider ?? 'unknown',
    version: lmService.model,
    lmService,
    ...config,
  });
}

/** Create an LM oracle for stream. */
export function createLMStreamOracle(
  lmService: LMOracleService,
  config: Partial<Omit<LMOracleConfig, 'operation' | 'lmService'>> = {}
): LMOracle {
  return new LMOracle({
    operation: 'lm.stream',
    provider: lmService.provider ?? 'unknown',
    version: lmService.model,
    lmService,
    ...config,
  });
}

/** Register all LM oracles with the registry. */
export function registerLMOracles(lmService: LMOracleService, pinStore?: OraclePinStore): LMOracle[] {
  const oracles = [
    createLMGenerateTextOracle(lmService),
    createLMGenerateObjectOracle(lmService),
    createLMStreamOracle(lmService),
  ];

  if (pinStore) {
    for (const oracle of oracles) {
      oracle.setPinStore(pinStore);
    }
  }

  // Register with global registry
  const { oracleRegistry } = require('./oracle.js');
  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}

