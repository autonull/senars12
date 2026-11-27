import { TASK_PUNCTUATION as PUNCTUATION_BY_TASK_TYPE, type TaskPunctuation, type TaskType, taskTypeForPunctuation } from '@senars/schemas/task';
import { SenarsError } from '@senars/errors';
import type { Term } from '../types';
import { Truth } from './Truth';
export interface ParserResult {
    term: Term;
    truth?: Truth;
    statements?: ParserResult[];
}
export type TaskTypeName = TaskType;
/** The sentence mark each task kind is written with — the kernel's table, re-exported
 *  here because the grammar, not the wire, is where a Narsese task is punctuated. */
export { PUNCTUATION_BY_TASK_TYPE, taskTypeForPunctuation };
export interface ParseTaskResult {
    term: Term;
    taskType: TaskTypeName;
    truth?: Truth;
    punctuation: TaskPunctuation;
}
export interface ParserPosition {
    line: number;
    column: number;
    offset: number;
}
export declare class ParseError extends SenarsError {
    position: ParserPosition;
    token?: unknown;
    constructor(message: string, position: ParserPosition, token?: unknown, options?: ErrorOptions);
}
export declare class TermParser {
    private get termFactory();
    parse(input: string): Term;
    parseMultiple(input: string): ParserResult[];
    parseWithTruth(input: string): {
        term: Term;
        truth?: Truth;
    };
    parseTask(input: string): ParseTaskResult | null;
    private _validateInput;
    private _wrapError;
}
export declare const termParser: TermParser;
export declare const deserializeTerm: (s: string) => Term | null;
/**
 * Canonical Narsese string → Term API. Delegates to {@link deserializeTerm}.
 * Returns `null` when the input is not parseable.
 * @public
 */
export declare const fromNarsese: (s: string) => Term | null;
/**
 * Parse `text` as a task under any punctuation the grammar admits, or `null` if
 * none parses.
 *
 * A term is not a claim and a claim is punctuated, so a bare `(a --> b)` is
 * neither until it is given its sentence mark — and which mark was intended is
 * not recoverable from the text. Rather than make every ingress guess, the
 * grammar's own set is tried in order and the first that parses wins.
 *
 * This lives beside the parser rather than at any ingress because two ingresses
 * needed it and neither could reach the other: the perception gate admits a task
 * it must parse, and the NL router must answer the same question before it
 * decides an utterance is Narsese at all. Two copies of this loop is how they
 * came to disagree.
 * @public
 */
export declare const parseTaskTolerant: (text: string) => ParseTaskResult | null;
//# sourceMappingURL=parser-peggy.d.ts.map