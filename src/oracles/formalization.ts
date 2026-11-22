/**
 * Formalization Oracle — wraps the formalizer through the oracle seam.
 *
 * This makes the formalizer capability available as a faculty via the oracle system.
 */

import type { Oracle, OracleInput, OracleOutput, OracleConfig, OracleOperation } from './oracle.js';
import { oracleRegistry } from './oracle.js';
import { createFormalizer, type Formalizer, type PerceivedInterpretation } from '../nl/formalizer.js';
import type { ILMService } from '../lm/interfaces.js';
import type { GenerationInput, GenerationOutput } from '../nl/generation.js';
import type { NLContext } from '../nl/understanding.js';

/** Input for nlToFormal oracle call. */
export interface NLToFormalInput extends OracleInput {
  operation: 'formalization.nlToFormal';
  args: [text: string, ctx?: NLContext];
}

/** Input for formalToNl oracle call. */
export interface FormalToNlInput extends OracleInput {
  operation: 'formalization.formalToNl';
  args: [input: GenerationInput];
}

/** Formalization oracle configuration. */
export interface FormalizationOracleConfig extends OracleConfig {
  operation: 'formalization.nlToFormal' | 'formalization.formalToNl';
  lmService: ILMService | null | undefined;
}

/** Formalization oracle implementation. */
export class FormalizationOracle implements Oracle<NLToFormalInput | FormalToNlInput, PerceivedInterpretation | GenerationOutput> {
  public readonly operation: 'formalization.nlToFormal' | 'formalization.formalToNl';
  public readonly provider: string;
  public readonly version?: string;

  private readonly formalizer: Formalizer;

  constructor(config: FormalizationOracleConfig) {
    this.operation = config.operation;
    this.provider = config.provider;
    this.version = config.version;
    this.formalizer = createFormalizer(config.lmService);
  }

  async call(input: NLToFormalInput | FormalToNlInput): Promise<OracleOutput<PerceivedInterpretation | GenerationOutput>> {
    const callId = crypto.randomUUID();
    const startTs = Date.now();
    let value: PerceivedInterpretation | GenerationOutput;

    try {
      if (input.operation === 'formalization.nlToFormal') {
        const [text, ctx] = input.args;
        value = await this.formalizer.nlToFormal(text, ctx);
      } else {
        const [genInput] = input.args;
        value = await this.formalizer.formalToNl(genInput);
      }
    } catch (e) {
      throw e;
    } finally {
      // Telemetry would be emitted here by the base class mechanism
    }

    return {
      value,
      meta: {
        callId,
        ts: startTs,
        durationMs: Date.now() - startTs,
        provider: this.provider,
        version: this.version,
        pinned: false,
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  setPinStore(_store: any): void {
    // Pin store not implemented for formalization oracle yet
  }

  getStats() {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      pinnedCalls: 0,
      totalDurationMs: 0,
    };
  }
}

/** Create a formalization oracle for nlToFormal. */
export function createNLToFormalOracle(
  lmService: ILMService | null | undefined,
  config: Partial<Omit<FormalizationOracleConfig, 'operation' | 'lmService'>> = {}
): FormalizationOracle {
  return new FormalizationOracle({
    operation: 'formalization.nlToFormal',
    provider: lmService?.provider ?? 'structured',
    version: lmService?.model,
    lmService,
    ...config,
  });
}

/** Create a formalization oracle for formalToNl. */
export function createFormalToNlOracle(
  lmService: ILMService | null | undefined,
  config: Partial<Omit<FormalizationOracleConfig, 'operation' | 'lmService'>> = {}
): FormalizationOracle {
  return new FormalizationOracle({
    operation: 'formalization.formalToNl',
    provider: lmService?.provider ?? 'structured',
    version: lmService?.model,
    lmService,
    ...config,
  });
}

/** Register both formalization oracles with the registry. */
export function registerFormalizationOracles(
  lmService: ILMService | null | undefined
): FormalizationOracle[] {
  const oracles = [
    createNLToFormalOracle(lmService),
    createFormalToNlOracle(lmService),
  ];

  for (const oracle of oracles) {
    oracleRegistry.register(oracle);
  }

  return oracles;
}