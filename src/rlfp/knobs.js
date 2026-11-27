import { getNested, setNested } from '@senars/util/object';
import { indexBy, keyedBy } from '@senars/util/collections';
import { cognitiveBound, systemOneBound } from '../config/bound-table';
/**
 * One knob, projected from the bound row that owns its numbers.
 *
 * The three limits and the write-time quantization were two spellings of one row: the
 * table held them for validation and the knob re-implemented the clamp for writes. Naming
 * the row is what makes them the same thing.
 */
const knob = (root, name, path, bounds, boundPath) => ({
    name,
    path,
    root,
    ...bounds.spec(boundPath),
    quantize: (value) => bounds.quantize(boundPath, value),
});
/**
 * The tunable subset of `cognitiveBounds`, with every range projected by its own row.
 *
 * These rows used to restate their `min`/`max`/`step` by hand, and nine of the ten had
 * drifted from the canonical table — the tuner could not reach values the config schema
 * already admitted. *Which* parameters are tunable is a decision; the numbers are not.
 */
const cognitiveKnobs = [
    knob('cognitive', 'maxDerivationsPerStep', 'inference.maxDerivationsPerStep', cognitiveBound, 'inference.maxDerivationsPerStep'),
    knob('cognitive', 'maxDerivationDepth', 'inference.maxDerivationDepth', cognitiveBound, 'inference.maxDerivationDepth'),
    knob('cognitive', 'maxRulesPerCycle', 'lm.maxRulesPerCycle', cognitiveBound, 'lm.maxRulesPerCycle'),
    knob('cognitive', 'callTimeoutMs', 'lm.callTimeoutMs', cognitiveBound, 'lm.callTimeoutMs'),
    knob('cognitive', 'decayRate', 'priority.decayRate', cognitiveBound, 'priority.decayRate'),
    knob('cognitive', 'cpuThrottleMs', 'inference.cpuThrottleMs', cognitiveBound, 'inference.cpuThrottleMs'),
    knob('cognitive', 'maxLoops', 'modelRunner.maxLoops', cognitiveBound, 'modelRunner.maxLoops'),
    knob('cognitive', 'activationDecayRate', 'memory.activationDecayRate', cognitiveBound, 'memory.activationDecayRate'),
    knob('cognitive', 'rankingMaxAdmissions', 'inference.ranking.maxAdmissions', cognitiveBound, 'inference.rankingMaxAdmissions'),
    knob('cognitive', 'rankingMinScore', 'inference.ranking.minScore', cognitiveBound, 'inference.rankingMinScore'),
];
/** Every tunable System One row, addressed as `category.key`. */
const SYSTEM_ONE_KNOBS = [
    'budgets.maxJudgmentCallsPerCycle',
    'budgets.maxConsensusPerCycle',
    'budgets.maxLatencyMsPerJudgment',
    'budgets.maxTokensPerCycle',
    'budgets.maxMemoryMbPerCycle',
    'provisional.cInitial',
    'provisional.decayRate',
    'provisional.maxTtlMs',
];
const systemOneKnobs = SYSTEM_ONE_KNOBS.map((boundPath) => knob('systemOne', `systemOne.${boundPath}`, `systemOne.${boundPath}`, systemOneBound, boundPath));
export const KNOB_SPECS = [...cognitiveKnobs, ...systemOneKnobs];
const specByName = indexBy(KNOB_SPECS, (s) => s.name);
export function findKnobSpec(name) {
    return specByName.get(name);
}
function makeKnob(spec, params) {
    return {
        ...spec,
        get() {
            return getNested(params, spec.path);
        },
        set(value) {
            setNested(params, spec.path, spec.quantize(value));
        },
    };
}
export function createKnobSet(params, systemOne) {
    const roots = {
        cognitive: params,
        systemOne,
    };
    return keyedBy(KNOB_SPECS.filter((s) => roots[s.root]), (s) => s.name, (s) => makeKnob(s, roots[s.root]));
}
export { cognitiveKnobs as knobSchema, systemOneKnobs as systemOneKnobSchema };
