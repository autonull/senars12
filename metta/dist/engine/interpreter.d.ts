import { Effect } from 'effect';
import { MeTTaError } from '../core/errors.js';
import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';
export declare class MeTTaInterpreter {
    private readonly spaces;
    private readonly pipeline;
    addSpace(space: MeTTaSpace): void;
    evaluate(program: MeTTaAtom, spaceId?: string): Effect.Effect<MeTTaAtom, MeTTaError>;
    private reduce;
    private reduceExpr;
}
//# sourceMappingURL=interpreter.d.ts.map