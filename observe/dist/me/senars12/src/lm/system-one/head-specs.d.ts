/**
 * Head construction: a spec row plus factory options become a `JudgmentHead`. The
 * vocabulary itself is `head-ontology.ts`, which depends on nothing here — so the
 * calibration suite and the pipeline can read the head list without importing a
 * calibrator.
 */
import { type HeadGroup, type HeadId, type HeadSpec } from './head-ontology';
import type { HeadFactoryOptions } from './heads/factory';
import type { ClassifyQuery, JudgmentHead, JudgmentQuery, RubricId } from './types';
export type { HeadGroup, HeadId, HeadSpec } from './head-ontology';
export type { HeadFactoryOptions } from './heads/factory';
export type { CalibrationVersion, ClassifyQuery, EmbeddingCache, EvaluateQuery, JudgmentQuery, } from './types';
/** Build one JudgmentHead from its spec entry (sole implementation; factory.ts delegates). */
export declare function createHead(spec: HeadSpec, options: HeadFactoryOptions): JudgmentHead;
export declare function createHeadsForGroup(group: HeadGroup, options: HeadFactoryOptions): Map<RubricId, JudgmentHead>;
export declare function createHeadById(id: HeadId, options: HeadFactoryOptions): JudgmentHead;
/** Every head in one map, in ontology order — what the manifold judges with. */
export declare function createAllHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead>;
export declare function groupQueries(group: HeadGroup): JudgmentQuery[];
export declare const ingressQueries: () => readonly JudgmentQuery[];
export declare const actionQueries: () => readonly JudgmentQuery[];
export declare function selectQuery(space: readonly string[], instruction: string): ClassifyQuery;
//# sourceMappingURL=head-specs.d.ts.map