export interface LMContext {
    memorySnapshot?: string;
    relatedBeliefs?: string[];
    recentDerivations?: string[];
    activeGoals?: string[];
    confidence?: number;
    conceptPriority?: number;
    taskTerm?: string;
    secondaryTerm?: string;
    taskType?: string;
    driveState?: Record<string, number>;
    conflictCount?: number;
    memoryPressure?: number;
    totalConcepts?: number;
}
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
export declare const TEMPLATE_PLACEHOLDERS: readonly ['taskTerm', 'primaryTerm', 'secondaryTerm', 'premise1', 'premise2'];
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];
/** A resolved value per placeholder; an absent one renders as nothing. */
export type TemplateValues = Readonly<Partial<Record<TemplatePlaceholder, string>>>;
/** Substitute every placeholder `values` resolves, leaving the rest of the text alone. */
export declare const interpolateTemplate: (template: string, values: TemplateValues) => string;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
}
//# sourceMappingURL=types.d.ts.map