/**
 * The judgment-head ontology: which rubrics exist, what each judges over, and
 * which group judges it. The vocabulary, with nothing that builds anything in it.
 *
 * It is a module of its own because three readers need the table without the
 * machinery that consumes it — the calibration suite (which calibrates one
 * calibrator per rubric), the judgment pipeline (whose default stages are the
 * groups), and the head factory (which builds a head from a row). Keeping the
 * table inside the factory meant those two readers had to restate the list, and
 * they did: the calibrators were built for a hand-written copy that listed
 * `feasibility` twice and had never heard of `episodic_match`.
 */
import type { CognitiveAxis, CriticalityLevel, EvaluateQuery, JudgmentQuery, RubricId } from './types';
export interface HeadSpec {
    readonly rubric: RubricId;
    readonly axis: CognitiveAxis;
    readonly kind: 'classify' | 'evaluate';
    readonly space?: readonly string[];
    readonly levels?: readonly string[];
    readonly instruction: string;
    readonly criticality?: CriticalityLevel;
    readonly group: 'ingress' | 'action' | 'synthesis' | 'memory';
}
export declare const HEAD_SPECS: {
    readonly task_type: {
        readonly rubric: 'task_type';
        readonly axis: 'epistemic';
        readonly kind: 'classify';
        readonly space: readonly ["belief", "goal", "question", "command"];
        readonly instruction: 'Classify the task type';
        readonly group: 'ingress';
    };
    readonly illocution: {
        readonly rubric: 'illocution';
        readonly axis: 'epistemic';
        readonly kind: 'classify';
        readonly space: readonly ["assert", "query", "command", "promise", "express"];
        readonly instruction: 'Classify the illocutionary force';
        readonly group: 'ingress';
    };
    readonly injection: {
        readonly rubric: 'injection';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["none", "low", "medium", "high", "critical"];
        readonly instruction: 'Evaluate injection risk';
        readonly criticality: 'critical';
        readonly group: 'ingress';
    };
    readonly ambiguity: {
        readonly rubric: 'ambiguity';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["clear", "slight", "moderate", "high", "severe"];
        readonly instruction: 'Evaluate ambiguity';
        readonly group: 'ingress';
    };
    readonly tense: {
        readonly rubric: 'tense';
        readonly axis: 'epistemic';
        readonly kind: 'classify';
        readonly space: readonly ["past", "present", "future", "timeless"];
        readonly instruction: 'Classify the tense';
        readonly group: 'ingress';
    };
    readonly source_quality: {
        readonly rubric: 'source_quality';
        readonly axis: 'epistemic';
        readonly kind: 'classify';
        readonly space: ("GENERAL" | "LLM_PRIOR" | "PEER_AGENT" | "PRIMARY" | "SECONDARY" | "SELF_METTA" | "TERTIARY")[];
        readonly instruction: 'Classify the source quality';
        readonly group: 'ingress';
    };
    readonly tool_dispatch: {
        readonly rubric: 'tool_dispatch';
        readonly axis: 'teleological';
        readonly kind: 'classify';
        readonly space: readonly ["none", "low", "medium", "high", "critical"];
        readonly instruction: 'Classify the tool dispatch criticality';
        readonly group: 'action';
    };
    readonly risk: {
        readonly rubric: 'risk';
        readonly axis: 'teleological';
        readonly kind: 'classify';
        readonly space: readonly ["none", "low", "medium", "high", "critical"];
        readonly instruction: 'Classify the risk level';
        readonly group: 'action';
    };
    readonly feasibility: {
        readonly rubric: 'feasibility';
        readonly axis: 'teleological';
        readonly kind: 'evaluate';
        readonly levels: readonly ["impossible", "unlikely", "possible", "likely", "certain"];
        readonly instruction: 'Evaluate feasibility';
        readonly group: 'action';
    };
    readonly strategy: {
        readonly rubric: 'strategy';
        readonly axis: 'teleological';
        readonly kind: 'classify';
        readonly space: readonly ["explore", "exploit", "deliberate", "delegate"];
        readonly instruction: 'Classify the strategy';
        readonly group: 'action';
    };
    readonly reflex_value: {
        readonly rubric: 'reflex_value';
        readonly axis: 'teleological';
        readonly kind: 'evaluate';
        readonly levels: readonly ["very-low", "low", "medium", "high", "very-high"];
        readonly instruction: 'Evaluate reflex value';
        readonly group: 'action';
    };
    readonly candidate_select: {
        readonly rubric: 'candidate_select';
        readonly axis: 'teleological';
        readonly kind: 'classify';
        readonly space: readonly ["candidate_1", "candidate_2", "candidate_3"];
        readonly instruction: 'Select the best candidate';
        readonly group: 'synthesis';
    };
    readonly plausibility: {
        readonly rubric: 'plausibility';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["false", "true"];
        readonly instruction: 'Evaluate whether the statement is true';
        readonly group: 'synthesis';
    };
    readonly assertion: {
        readonly rubric: 'assertion';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["unsupported", "supported"];
        readonly instruction: 'Evaluate whether the claim is supported by the evidence';
        readonly criticality: 'high';
        readonly group: 'synthesis';
    };
    readonly conflict: {
        readonly rubric: 'conflict';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["support", "neutral", "conflict", "strong-conflict"];
        readonly instruction: 'Evaluate conflict';
        readonly group: 'synthesis';
    };
    readonly groundedness: {
        readonly rubric: 'groundedness';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["ungrounded", "weakly-grounded", "grounded", "strongly-grounded"];
        readonly instruction: 'Evaluate groundedness';
        readonly group: 'synthesis';
    };
    readonly relevance: {
        readonly rubric: 'relevance';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["irrelevant", "tangential", "relevant", "highly-relevant"];
        readonly instruction: 'Evaluate relevance';
        readonly group: 'memory';
    };
    readonly episodic_match: {
        readonly rubric: 'episodic_match';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["no-match", "weak-match", "match", "strong-match"];
        readonly instruction: 'Evaluate episodic match';
        readonly group: 'memory';
    };
    readonly novelty: {
        readonly rubric: 'novelty';
        readonly axis: 'epistemic';
        readonly kind: 'evaluate';
        readonly levels: readonly ["known", "slightly-novel", "novel", "highly-novel"];
        readonly instruction: 'Evaluate novelty';
        readonly group: 'memory';
    };
};
/** Every rubric has a head, by type: `Record<RubricId, …>` rather than
 *  `Record<string, …>`. The vocabulary grew a member nobody implemented and nothing
 *  failed — a rubric could be asked for, and no head existed to answer it. */
export type HeadId = RubricId;
export type HeadGroup = HeadSpec['group'];
/** Every spec, in declaration order. */
export declare const ALL_HEAD_SPECS: readonly HeadSpec[];
/** The specs of one group, in declaration order — a pipeline stage, a head set. */
export declare const headSpecsInGroup: (group: HeadGroup) => readonly HeadSpec[];
/** One rubric per head, in declaration order: everything a calibrator is built for. */
export declare const headRubrics: () => readonly RubricId[];
/** Shared query builders (X10) — single construction sites for judgment queries. */
export declare function specToQuery(spec: HeadSpec): JudgmentQuery;
/**
 * An epistemic evaluate query over one rubric. Six call sites rebuilt this shape by
 * hand, each casting the rubric with `as never` — which is how a rubric that no head
 * has, and three different sets of default rubrics, all typechecked. Typed on the
 * rubric, the cast is the only thing a caller can no longer do by accident.
 */
export declare const evaluateQuery: (rubric: RubricId, instruction?: string) => EvaluateQuery;
//# sourceMappingURL=head-ontology.d.ts.map