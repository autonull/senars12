import type { Effect } from 'effect';
import type { MeTTaConfig } from '../core/config.js';
import type { MeTTaError } from '../core/errors.js';
import type { MeTTaInterpreter } from '../engine/interpreter.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaContext } from './context.js';
export declare class MeTTaBuilder {
  private config;
  private interpreter;
  constructor();
  withConfig(overrides: Partial<MeTTaConfig>): this;
  withSpace(id: string): this;
  build(): MeTTaRuntime;
}
export declare class MeTTaRuntime {
  private readonly interpreter;
  private readonly config;
  constructor(interpreter: MeTTaInterpreter, config: MeTTaConfig);
  evaluate(program: MeTTaAtom, ctx?: Partial<MeTTaContext>): Effect.Effect<MeTTaAtom, MeTTaError>;
}
export declare function createMeTTa(config?: Partial<MeTTaConfig>): MeTTaRuntime;
//# sourceMappingURL=builder.d.ts.map
