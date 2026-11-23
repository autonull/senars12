/**
 * GBNF-Constrained Decoding Oracle — wraps action-grammar and constrained
 * generation through the oracle seam.
 */

import { createHash } from 'crypto';
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { OraclePinStore } from './pins';
import { actionGrammar } from '../lm/system-one/action-grammar';
import type { LMOracleService } from './lm';
import { SenarsError } from '../errors/senars-error';


/** Input for generating GBNF grammar. */
export interface GbnfGenerateGrammarInput extends OracleInput {
  operation: 'gbnf.generateGrammar';
  args: [legalActions: readonly string[]];
}

/** Input for constrained generation with GBNF. */
export interface GbnfConstrainedGenerateInput extends OracleInput {
  operation: 'gbnf.constrainedGenerate';
  args: [prompt: string, grammar: string, options?: { task?: string; temperature?: number; maxTokens?: number }];
}

/** Input for getting available actions. */
export interface GbnfGetActionsInput extends OracleInput {
  operation: 'gbnf.getActions';
  args: [state: unknown]; // Game state or context
}

/** GBNF Oracle configuration. */
export interface GbnfOracleConfig extends OracleConfig {
  operation: 'gbnf.generateGrammar' | 'gbnf.constrainedGenerate' | 'gbnf.getActions';
  lmService?: LMOracleService;
  actionProvider?: (state: unknown) => readonly string[];
}

/** GBNF Oracle implementation. */
export class GbnfOracle implements Oracle<
  GbnfGenerateGrammarInput | GbnfConstrainedGenerateInput | GbnfGetActionsInput,
  string | { text: string; grammar: string } | readonly string[]
> {
  public readonly operation: GbnfOracleConfig['operation'];
  public readonly provider: string;
  public readonly version?: string;
  public readonly budgetResource?: BudgetResource;

  private lmService?: LMOracleService;
  private actionProvider?: GbnfOracleConfig['actionProvider'];
  private pinStore: OraclePinStore | null = null;
  private isReplay = false;
  private defaultBudgetSlice?: BudgetSlice;

  private stats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    pinnedCalls: 0,
    totalDurationMs: 0,
  };

  constructor(config: GbnfOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.budgetResource = config.budgetResource;
    this.defaultBudgetSlice = config.budgetSlice;
    this.lmService = config.lmService;
    this.actionProvider = config.actionProvider;
  }

  setPinStore(store: OraclePinStore): void {
    this.pinStore = store;
  }

  setReplayMode(replay: boolean): void {
    this.isReplay = replay;
  }

  async call(
    input: GbnfGenerateGrammarInput | GbnfConstrainedGenerateInput | GbnfGetActionsInput,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<string | { text: string; grammar: string } | readonly string[]>> {
    const effectiveBudgetSlice = budgetSlice ?? this.defaultBudgetSlice;
    if (effectiveBudgetSlice && this.budgetResource) {
      const { consume } = await import('../budget/budget');
      const charged = consume(effectiveBudgetSlice, this.budgetResource, 1);
      if (!charged) {
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        this.stats.totalCalls++;
        this.stats.failedCalls++;
        const error = `Budget exhausted for ${this.budgetResource}`;
        return {
          value: null as any,
          meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: false, error },
        };
      }
    }

    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let pinned = false;
    let error: string | undefined;
    let value: string | { text: string; grammar: string } | readonly string[];

    this.stats.totalCalls++;

    try {
      if (this.isReplay && this.pinStore) {
        const pinnedValue = await this.pinStore.getPin(this.operation, input.args, this.provider, this.version, input.context);
        if (pinnedValue !== null) {
          this.stats.pinnedCalls++;
          this.stats.successfulCalls++;
          return {
            value: pinnedValue as any,
            meta: { callId, ts: startTs, durationMs: 0, provider: this.provider, version: this.version, pinned: true },
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
      meta: { callId, ts: startTs, durationMs: Date.now() - startTs, provider: this.provider, version: this.version, pinned, error },
    };
  }

  private async execute(
    input: GbnfGenerateGrammarInput | GbnfConstrainedGenerateInput | GbnfGetActionsInput
  ): Promise<string | { text: string; grammar: string } | readonly string[]> {
    switch (this.operation) {
      case 'gbnf.generateGrammar': {
        const args = input.args as [readonly string[]];
        const [legalActions] = args;
        return actionGrammar(legalActions);
      }

      case 'gbnf.constrainedGenerate': {
        const args = input.args as [string, string, { task?: 'compact' | 'fast' | 'quality' | 'structured'; temperature?: number; maxTokens?: number }?];
        const [prompt, grammar, options] = args;
        if (!this.lmService) throw new SenarsError('LM service not configured for constrained generation', 'CONFIGURATION_ERROR');

        const { generateObject } = await import('ai');
        const { zodSchema } = await import('ai');
        const { z } = await import('zod');

        const task = options?.task ?? 'structured';
        const model = this.lmService.getModel(task);
        if (!model) throw new SenarsError(`No model available for task: ${task}`, 'OPERATION_ERROR');

        // Use the grammar as a constraint - we parse it to extract allowed values
        // For GBNF, we use a schema that matches the grammar's root rule
        const schema = zodSchema(z.string()); // Simplified - real impl would parse GBNF

        const result = await generateObject({
          model,
          prompt,
          schema: schema as any,
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
        } as any);

        return { text: result.object as string, grammar: grammar };
      }

      case 'gbnf.getActions': {
        const args = input.args as [unknown];
        const [state] = args;
        if (!this.actionProvider) throw new SenarsError('Action provider not configured', 'CONFIGURATION_ERROR');
        return this.actionProvider(state);
      }

      default:
        throw new SenarsError(`Unknown GBNF operation: ${(input as any).operation}`, 'VALIDATION_ERROR');
    }
  }

  private hashInput(args: unknown[]): string {
    const json = JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getStats() {
    return { ...this.stats };
  }
}

/** Create a GBNF oracle for grammar generation. */
export function createGbnfGrammarOracle(
  config: Partial<Omit<GbnfOracleConfig, 'operation'>> = {}
): GbnfOracle {
  return new GbnfOracle({
    operation: 'gbnf.generateGrammar',
    provider: 'gbnf',
    ...config,
  });
}

/** Create a GBNF oracle for constrained generation. */
export function createGbnfConstrainedOracle(
  lmService: LMOracleService,
  config: Partial<Omit<GbnfOracleConfig, 'operation' | 'lmService'>> = {}
): GbnfOracle {
  return new GbnfOracle({
    operation: 'gbnf.constrainedGenerate',
    provider: 'gbnf',
    version: lmService.model,
    lmService,
    ...config,
  });
}

/** Create a GBNF oracle for action enumeration. */
export function createGbnfActionsOracle(
  actionProvider: (state: unknown) => readonly string[],
  config: Partial<Omit<GbnfOracleConfig, 'operation' | 'actionProvider'>> = {}
): GbnfOracle {
  return new GbnfOracle({
    operation: 'gbnf.getActions',
    provider: 'gbnf',
    actionProvider,
    ...config,
  });
}

/** Register all GBNF oracles with the registry. */
export function registerGbnfOracles(
  lmService: LMOracleService | undefined,
  actionProvider: ((state: unknown) => readonly string[]) | undefined,
  pinStore?: OraclePinStore
): GbnfOracle[] {
  const oracles: GbnfOracle[] = [
    createGbnfGrammarOracle(),
  ];

  if (lmService) {
    oracles.push(createGbnfConstrainedOracle(lmService));
  }

  if (actionProvider) {
    oracles.push(createGbnfActionsOracle(actionProvider));
  }

  if (pinStore) {
    for (const oracle of oracles) {
      oracle.setPinStore(pinStore);
    }
  }

  const { oracleRegistry } = require('./oracle');
  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}