/**
 * C5: the per-game MetaGame as a thin spec over the component library —
 * the former `focus_weight`/`knob_set` literal lists are data here,
 * generated once and shared. SelfMetaGame keeps its system scope (its knobs
 * are system-scoped ParameterTable entries, F5).
 */
export declare const FOCUS_WEIGHT_STEPS: readonly number[];
export declare const KNOB_SET_VALUES: Readonly<Record<string, readonly number[]>>;
/** Operation strings are domain-tagged for kernel ActionGate enforcement. */
export declare const describeMetaGameActions: (focusIds: readonly string[]) => string[];
//# sourceMappingURL=meta-spec.d.ts.map