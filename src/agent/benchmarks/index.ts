import type {Scenario} from '../scenarios/types.js';
import {nal1DeductionSuite, nal1InductionSuite, nal1AbductionSuite} from './nal1.js';
import nal2CompoundSuite from './nal2.js';
import nal3HigherOrderSuite from './nal3.js';
import nal4RevisionSuite from './nal4.js';
import nal5NegationSuite from './nal5.js';
import nal7TemporalSuite from './nal7.js';
import nal8ProceduralSuite from './nal8.js';
import nal9SelfSuite from './nal9.js';
import toolsBasicSuite from './tools.js';
import chatBasicSuite from './chat.js';
import memoryOpsSuite from './memory.js';
import lmRulesSuite from './lm.js';

export interface BenchmarkSuite {
    id: string;
    name: string;
    tag: string;
    scenarios: Scenario[];
}

export const allSuites: BenchmarkSuite[] = [
    {id: 'nal1-deduction', name: 'NAL-1 Deduction', tag: 'nal1', scenarios: nal1DeductionSuite},
    {id: 'nal1-induction', name: 'NAL-1 Induction', tag: 'nal1', scenarios: nal1InductionSuite},
    {id: 'nal1-abduction', name: 'NAL-1 Abduction', tag: 'nal1', scenarios: nal1AbductionSuite},
    {id: 'nal2-compound', name: 'NAL-2 Compound', tag: 'nal2', scenarios: nal2CompoundSuite},
    {id: 'nal3-higher', name: 'NAL-3 Higher-Order', tag: 'nal3', scenarios: nal3HigherOrderSuite},
    {id: 'nal4-revision', name: 'NAL-4 Revision', tag: 'nal4', scenarios: nal4RevisionSuite},
    {id: 'nal5-negative', name: 'NAL-5 Negation', tag: 'nal5', scenarios: nal5NegationSuite},
    {id: 'nal7-temporal', name: 'NAL-7 Temporal', tag: 'nal7', scenarios: nal7TemporalSuite},
    {id: 'nal8-procedural', name: 'NAL-8 Procedural', tag: 'nal8', scenarios: nal8ProceduralSuite},
    {id: 'nal9-self', name: 'NAL-9 Self', tag: 'nal9', scenarios: nal9SelfSuite},
    {id: 'tools-basic', name: 'Tools Basic', tag: 'tools', scenarios: toolsBasicSuite},
    {id: 'chat-basic', name: 'Chat Basic', tag: 'chat', scenarios: chatBasicSuite},
    {id: 'memory-ops', name: 'Memory Operations', tag: 'memory', scenarios: memoryOpsSuite},
    {id: 'lm-rules', name: 'LM Rules', tag: 'lm', scenarios: lmRulesSuite},
];

export function getSuiteById(id: string): BenchmarkSuite | undefined {
    return allSuites.find(s => s.id === id);
}

export function getSuiteByTag(tag: string): BenchmarkSuite | undefined {
    return allSuites.find(s => s.tag === tag);
}

export function getAllScenarios(): Scenario[] {
    return allSuites.flatMap(s => s.scenarios);
}

export {
    nal1DeductionSuite, nal1InductionSuite, nal1AbductionSuite,
    nal2CompoundSuite, nal3HigherOrderSuite, nal4RevisionSuite,
    nal5NegationSuite, nal7TemporalSuite, nal8ProceduralSuite,
    nal9SelfSuite, toolsBasicSuite, chatBasicSuite, memoryOpsSuite,
    lmRulesSuite,
};
