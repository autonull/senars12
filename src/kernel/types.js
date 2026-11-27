/**
 * Kernel Types — shared type definitions and utilities.
 *
 * Compatibility layer for generated schemas:
 * - Generated schemas use `frequency`/`confidence`
 * - Internal code uses `f`/`c` for brevity
 * This module provides both interfaces.
 */
/** Convert internal TruthValue to schema TruthValue. */
export function toSchemaTruth(t) {
    return { frequency: t.f, confidence: t.c };
}
/** Convert schema TruthValue to internal TruthValue. */
export function fromSchemaTruth(t) {
    return { f: t.frequency, c: t.confidence };
}
/** Task type enumeration. */
export var TaskType;
(function (TaskType) {
    TaskType["BELIEF"] = "belief";
    TaskType["GOAL"] = "goal";
    TaskType["QUESTION"] = "question";
})(TaskType || (TaskType = {}));
/** Task punctuation. */
export var TaskPunctuation;
(function (TaskPunctuation) {
    TaskPunctuation["STATEMENT"] = ".";
    TaskPunctuation["QUESTION"] = "?";
    TaskPunctuation["GOAL"] = "!";
})(TaskPunctuation || (TaskPunctuation = {}));
/** Task bag kind. */
export var TaskBagKind;
(function (TaskBagKind) {
    TaskBagKind["DERIVATION"] = "derivation";
    TaskBagKind["INPUT"] = "input";
    TaskBagKind["OUTPUT"] = "output";
})(TaskBagKind || (TaskBagKind = {}));
/** Create a task. */
export function createTask(term, type, truth, priority, stamp) {
    return { term, type, truth, priority, stamp };
}
