import { samplePremisesFromConfig } from '../../strategies/premise/primitives';
/** Named premise strategies are compositions of the source/scorer/filter primitives. */
export const createStrategy = (config) => {
    const { name, sampleSize, limit = 5, filter, truthFilter, ...primitives } = config;
    // Built once, not per `selectSecondary` call: the config is the identity
    // `samplePremisesFromConfig` keys its merged config and bound filters on, so
    // rebuilding it every cycle meant re-resolving the pipeline every cycle. The
    // escape hatches forward the pipeline's own task, which is the one
    // `selectSecondary` passed in.
    const sample = {
        ...primitives,
        sampleSize,
        limit,
        where: filter ? (t, concept) => filter(concept, t) : undefined,
        whereTruth: truthFilter ? (t, truth) => truthFilter(truth, t) : undefined,
    };
    return {
        name,
        sampleSize,
        limit,
        metadata: { name, description: `Premise strategy: ${name}` },
        selectSecondary(task, memory) {
            return samplePremisesFromConfig(memory, task, sample);
        },
    };
};
