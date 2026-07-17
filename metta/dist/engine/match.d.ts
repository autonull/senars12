import type { MeTTaAtom } from '../types/ast.js';
import type { MeTTaSpace } from '../types/space.js';
import { type Substitution } from './unify.js';
export declare class PatternMatcher {
    private space;
    constructor(space: MeTTaSpace);
    match(pattern: MeTTaAtom): Generator<Substitution>;
    search(pattern: MeTTaAtom): Generator<MeTTaAtom>;
    findOne(pattern: MeTTaAtom): Substitution | undefined;
}
//# sourceMappingURL=match.d.ts.map