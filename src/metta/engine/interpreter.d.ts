import { Effect } from 'effect';
import { MeTTaError } from '../core/errors';
import type { MeTTaContext } from '../runtime/context';
import type { MeTTaAtom } from '../types/ast';
import type { MeTTaSpace } from '../types/space';
export declare const DEFAULT_MAX_STEPS = 10000;
export declare class MeTTaInterpreter {
    private readonly context;
    private readonly spaces;
    constructor(context?: Partial<MeTTaContext>);
    addSpace(space: MeTTaSpace): void;
    evaluate(program: MeTTaAtom, spaceId?: string, overrides?: Partial<MeTTaContext>): Effect.Effect<MeTTaAtom, MeTTaError>;
    private reduce;
    private reduceExpr;
}
//# sourceMappingURL=interpreter.d.ts.map