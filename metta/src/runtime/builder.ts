import { MeTTaInterpreter } from '../engine/interpreter.js';
import { InMemorySpace } from '../core/space.js';
import type { MeTTaContext } from './context.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaConfig } from '../core/config.js';
import { createConfig } from '../core/config.js';
import { bootstrapStdLib } from '../stdlib/index.js';
import type { Effect } from 'effect';
import type { MeTTaError } from '../core/errors.js';

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
      memoryLimit: ctx?.memoryLimit ?? 1024 * 1024,
    };
    return this.interpreter.evaluate(program, 'default');
  }
}

export function createMeTTa(config?: Partial<MeTTaConfig>): MeTTaRuntime {
  return new MeTTaBuilder().withConfig(config ?? {}).build();
}