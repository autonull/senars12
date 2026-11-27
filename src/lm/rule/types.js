/**
 * The `{{...}}` vocabulary a rule template is written in.
 *
 * These were four `.replaceAll` calls in `LMRule` while the shipped templates
 * wrote a fifth, `{{taskTerm}}` — so the one rule whose entire prompt is "translate
 * this sentence" reached the model with the literal `{{taskTerm}}` where the
 * sentence belonged, and nothing said so. The names live with `LMContext` because
 * that is the vocabulary they read, so a placeholder and its field are declared
 * together.
 */
export const TEMPLATE_PLACEHOLDERS = [
    'taskTerm',
    'primaryTerm',
    'secondaryTerm',
    'premise1',
    'premise2',
];
/** Substitute every placeholder `values` resolves, leaving the rest of the text alone. */
export const interpolateTemplate = (template, values) => TEMPLATE_PLACEHOLDERS.reduce((text, name) => {
    const value = values[name];
    return value === undefined ? text : text.replaceAll(`{{${name}}}`, value);
}, template);
