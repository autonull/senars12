import type { Effect } from 'effect';
import type { MeTTaConfig } from '../core/config';
import { createConfig } from '../core/config';
import type { MeTTaError } from '../core/errors';
import { InMemorySpace } from '../core/space';
import { MeTTaInterpreter } from '../engine/interpreter';
import { bootstrapStdLib } from '../stdlib/index';
import type { MeTTaAtom } from '../types/ast';
import { DEFAULT_MEMORY_LIMIT, type MeTTaContext } from './context';

export class MeTTaBuilder {
  private config: MeTTaConfig;
  private interpreter: MeTTaInterpreter;

  constructor() {
    this.config = createConfig();
    this.interpreter = new MeTTaInterpreter();
    bootstrapStdLib();
    this.interpreter.addSpace(new InMemorySpace('default'));
  }

  withConfig(overrides: Partial<MeTTaConfig>): this {
    this.config = createConfig(overrides);
    return this;
  }

  withSpace(id: string): this {
    this.interpreter.addSpace(new InMemorySpace(id));
    return this;
  }

  build(): MeTTaRuntime {
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
