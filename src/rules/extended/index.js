import * as classical from './classical';
import * as comparisonExt from './comparison-ext';
import * as composition from './composition';
import * as conversion from './conversion';
import * as deductionExt from './deduction-ext';
import * as equivalence from './equivalence';
import * as temporal from './temporal';
import * as procedural from './procedural';
import * as structural from './structural';
import * as variable from './variable';
export const NALExtendedRules = {
    ...classical,
    ...structural,
    ...composition,
    ...equivalence,
    ...variable,
    ...conversion,
    ...deductionExt,
    ...temporal,
    ...procedural,
    ...comparisonExt,
};
