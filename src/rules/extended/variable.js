import { TermBuilder, termsEqual } from '../../terms';
import { getVars } from '../impls/rule-builder';
export const variableDependency = ([t1, t2]) => {
    const vars1 = getVars(t1);
    const vars2 = getVars(t2);
    if (vars1.length === 0 || vars2.length === 0)
        return undefined;
    const shared = vars1.filter((v1) => vars2.some((v2) => termsEqual(v2, v1)));
    if (shared.length === 0)
        return undefined;
    return TermBuilder.conjunction(...shared);
};
