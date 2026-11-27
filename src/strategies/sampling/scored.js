import { perPart, selectTopN, sortBy } from '@senars/util/collections';
const defaultSource = (memory) => memory.conceptValues();
export const rankedSample = (concepts, count, score) => selectTopN(concepts, count, score);
export const stratifiedSample = (concepts, count, score, bands = 4) => {
    if (count <= 0)
        return [];
    const sorted = sortBy(concepts, score);
    const perBand = perPart(count, bands, 1, Math.ceil);
    const bandSize = perPart(sorted.length, bands);
    const result = [];
    for (let b = 0; b < bands; b++)
        result.push(...sorted.slice(b * bandSize, b * bandSize + bandSize).slice(0, perBand));
    return result.slice(0, count);
};
export const defineScoredSampling = ({ name, description, score, source = defaultSource, }) => ({
    metadata: { name, description },
    sample: (memory, count) => rankedSample(source(memory), count, score),
});
