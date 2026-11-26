import type { Effect } from 'effect';
import type { MeTTaConfig } from '../core/config';
import { createConfig } from '../core/config';
import type { MeTTaError } from '../core/errors';
import { InMemorySpace } from '../core/space';
import { MeTTaInterpreter } from '../engine/interpreter';
import { bootstrapStdLib } from '../stdlib/index';
import type { MeTTaAtom } from '../types/ast';
import { DEFAULT_MEMORY_LIMIT, type MeTTaContext } from './context';
import { BaseBuilder, type BuilderStepRecord } from '@senars/util/builder';

/** MeTTa builder step record. */
export interface MeTTaBuilderStep extends BuilderStepRecord {}

export class MeTTaBuilder extends BaseBuilder<MeTTaRuntime, MeTTaBuilderStep> {
  private config: MeTTaConfig;
  private interpreter: MeTTaInterpreter;

  constructor() {
    super();
    this.config = createConfig();
    this.interpreter = new MeTTaInterpreter();
    bootstrapStdLib();
    this.interpreter.addSpace(new InMemorySpace('default'));
  }

  /** Helper: set field and record step. */
  private setAndRecord<T>(field: string, value: T, stepName: string, present = true, detail?: Record<string, unknown>): this {
    (this as Record<string, unknown>)[field] = value;
    return this.recordStep(stepName, present, detail);
  }

  withConfig(overrides: Partial<MeTTaConfig>): this {
    return this.setAndRecord('config', createConfig(overrides), 'withConfig');
  }

  withSpace(id: string): this {
    this.interpreter.addSpace(new InMemorySpace(id));
    return this.recordStep('withSpace', true, { spaceId: id });
  }

  override build(): MeTTaRuntime {
    return new MeTTaRuntime(this.interpreter, this.config);
  }
}

export class MeTTaRuntime {
  constructor(
    private readonly interpreter: MeTTaInterpreter,
    private readonly config: MeTTaConfig
  ) {}

  evaluate(program: MeTTaAtom, ctx?: Partial<MeTTaContext>): Effect.Effect<MeTTaAtom, MeTTaError> {
    const context: MeTTaContext = {
      maxSteps: ctx?.maxSteps ?? this.config.maxSteps,
      timeout: ctx?.timeout ?? this.config.timeout,
      memoryLimit: ctx?.memoryLimit ?? DEFAULT_MEMORY_LIMIT,
    };
    return this.interpreter.evaluate(program, 'default', context);
  }
}

export function createMeTTa(config?: Partial<MeTTaConfig>): MeTTaRuntime {
  return new MeTTaBuilder().withConfig(config ?? {}).build();
}