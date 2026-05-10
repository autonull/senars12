import type {Term} from './types.js';
import {getTermComplexity} from './complexity.js';
import {serializeTerm} from './serialize.js';

export const getTermSimilarity = (t1: Term, t2: Term): number => {
if (t1.hash === t2.hash) return 1.0;

const complexity1 = getTermComplexity(t1);
const complexity2 = getTermComplexity(t2);

const depthSim = 1 - Math.abs(complexity1.depth - complexity2.depth) / Math.max(complexity1.depth, complexity2.depth, 1);
const breadthSim = 1 - Math.abs(complexity1.breadth - complexity2.breadth) / Math.max(complexity1.breadth, complexity2.breadth, 1);
const operatorSim = 1 - Math.abs(complexity1.operatorCount - complexity2.operatorCount) / Math.max(complexity1.operatorCount, complexity2.operatorCount, 1);

const structuralSim = (depthSim + breadthSim + operatorSim) / 3;

const t1Str = serializeTerm(t1);
const t2Str = serializeTerm(t2);
const tokens1 = new Set(t1Str.split(/[\s(),]+/).filter(Boolean));
const tokens2 = new Set(t2Str.split(/[\s(),]+/).filter(Boolean));
const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
const union = new Set([...tokens1, ...tokens2]);
const jaccard = union.size > 0 ? intersection.size / union.size : 0;

return (structuralSim + jaccard) / 2;
};
