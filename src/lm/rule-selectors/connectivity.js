import { calculateSimilarity, sharesSymbol } from '../../terms';
import { ctxNumber } from './conditions';
export const isUnderconnected = (_primary, _secondary, ctx) => {
    return ctxNumber(ctx, 'linkCount') < ctxNumber(ctx, 'avgLinksPerConcept', 5) * 0.3;
};
export const hasStructuralSimilarityNoOverlap = (primary, secondary) => {
    if (!secondary)
        return false;
    const sim = calculateSimilarity(primary, secondary);
    return sim > 0.6 && !sharesSymbol(primary, secondary);
};
