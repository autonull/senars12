/**
 * The decision layer's vocabulary (TODO29.a §5.11, A11).
 *
 * **Why this is not under `lm/`.** §5.11 asks for the core's decision port to be
 * "typed in the layer's own vocabulary rather than a new one" — which cannot be
 * satisfied from inside `lm/`, because A2's gate resolves the cycle path's imports
 * and a nameable vocabulary is the whole point of the move. The module is a leaf:
 * it depends on `@senars/core` and the term layer, never on a provider, so
 * `core:no-lm` stays satisfied while the *contract* is still the committed one
 * rather than a paraphrase. The `lm/system-one` path re-exports it unchanged, so
 * every existing importer is untouched and there is no second copy.
 */
import { createBudget } from '../budget/budget';
import { z } from 'zod';
export const scoreDistributionSchema = z.object({ option: z.string(), p: z.number() });
export { BANDS, COGNITIVE_AXES, CognitiveAxisSchema as cognitiveAxisSchema, bandOrdinal, } from '../util/index';
export const RUBRIC_IDS = [
    'ambiguity',
    'relevance',
    'groundedness',
    'novelty',
    'feasibility',
    'conflict',
    'injection',
    'plausibility',
    'assertion',
    'task_type',
    'illocution',
    'tense',
    'source_quality',
    'tool_dispatch',
    'risk',
    'candidate_select',
    'reflex_value',
    'strategy',
    'episodic_match',
];
export const rubricIdSchema = z.enum(RUBRIC_IDS);
/** The rubric a name denotes, when it is one of them. A `--head` flag and any other
 *  free-text rubric reaches a caller as a string; the calls that used to cast it
 *  with `as never` also accepted names no head has, and one of them shipped a
 *  default list containing one. */
export const asRubricId = (name) => RUBRIC_IDS.includes(name) ? name : undefined;
/** How many candidates a synthesis request proposes when it names no count. */
export const DEFAULT_SYNTHESIS_CANDIDATES = 3;
/** The resolved candidate count for `query` — one default, not one per proposer. */
export const synthesisCandidateCount = (query) => query.maxCandidates ?? DEFAULT_SYNTHESIS_CANDIDATES;
/**
 * The slot names a synthesis request proposes into: `candidate_1` … `candidate_n`.
 *
 * A candidate that names no slot is an LM proposal the cortex never parsed, and
 * the ladder-tiers, the synthesizer and the stub fallback all have to agree on
 * the spelling for a downstream judge to line a proposal up with the query it
 * answers — they each wrote `candidate_${i + 1}` beside their own loop, and the
 * top-up path numbered by list length instead, so a short parse could repeat a
 * name it already held.
 */
export const candidateSlots = (count) => Array.from({ length: Math.max(0, count) }, (_, i) => `candidate_${i + 1}`);
/** The slot after `filled` are taken. */
export const nextCandidateSlot = (filled) => `candidate_${filled + 1}`;
/** The untrusted-boundary twin of {@link ResourceCost}; the two must not drift. */
export const resourceCostSchema = z.object({
    tokensIn: z.number(),
    tokensOut: z.number(),
    computeMs: z.number(),
    memoryMb: z.number(),
});
/**
 * A cost of nothing, for the paths where a head is local or declined and the
 * spend ledger still wants a row. Spelled as one constant because the literal
 * has four fields and appears on every such path; a site that remembered three
 * of them was a type error only until a field was added.
 */
export const NO_COST = Object.freeze({
    tokensIn: 0,
    tokensOut: 0,
    computeMs: 0,
    memoryMb: 0,
});
/** Defaults for a System One judgment pass: one judge, no derivation fan-out. */
export const SYSTEM_ONE_BUDGET_DEFAULTS = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
};
/**
 * Fresh System One budget. A factory, not a shared constant: budget consumers
 * mutate `consumed` in place, so every call site must own its own object.
 */
export const createSystemOneBudget = () => createBudget(SYSTEM_ONE_BUDGET_DEFAULTS);
