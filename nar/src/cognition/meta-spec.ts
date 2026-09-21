/**
 * C5: the per-game MetaGame as a thin spec over the component library —
 * the former `^focus_weight`/`^knob_set` literal lists are data here,
 * generated once and shared. SelfMetaGame keeps its system scope (its knobs
 * are system-scoped ParameterTable entries, F5).
 */

export const FOCUS_WEIGHT_STEPS: readonly number[] = [0.5, 0.8, 1.0];

export const KNOB_SET_VALUES: Readonly<Record<string, readonly number[]>> = {
  maxDerivationsPerStep: [100, 500, 1000],
};

/** Operation strings are domain-tagged for kernel ActionGate enforcement. */
export const describeMetaGameActions = (focusIds: readonly string[]): string[] => [
  ...focusIds.flatMap((focusId) => FOCUS_WEIGHT_STEPS.map((w) => `^focus_weight(${focusId}, ${w})`)),
  ...Object.entries(KNOB_SET_VALUES).flatMap(([knob, values]) =>
    values.map((v) => `^knob_set(${knob}, ${v})`)
  ),
];
