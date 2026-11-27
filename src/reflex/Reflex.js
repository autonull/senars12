/**
 * The one reflex salience: `value × confidence` — the product the quorum
 * accumulates, the focus projects onto priority, and {@link byExpectedValue}
 * ranks by. Spelled inline at six sites, any of which could disagree.
 */
export const expectedValue = ({ value, confidence }) => value * confidence;
/** The one reflex ranking order: highest {@link expectedValue} first. */
export const byExpectedValue = (a, b) => expectedValue(b) - expectedValue(a);
