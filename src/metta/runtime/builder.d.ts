import type { Effect } from 'effect';
import type { MeTTaConfig } from '../core/config';
import type { MeTTaError } from '../core/errors';
import { MeTTaInterpreter } from '../engine/interpreter';
import type { MeTTaAtom } from '../types/ast';
import { type MeTTaContext } from './context';
import { BaseBuilder, type BuilderStepRecord } from '@senars/util/builder';
/** MeTTa builder step record. */
export interface MeTTaBuilderStep extends BuilderStepRecord {
}
export declare class MeTTaBuilder extends BaseBuilder<MeTTaRuntime, MeTTaBuilderStep> {
    private config;
    private interpreter;
    constructor();
    /** Helper: set field and record step. */
    private setAndRecord;
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