// senars Peggy parser wrapper
// This replaces the hand-written recursive descent parser
import { createRequire } from 'node:module';
import { TASK_PUNCTUATION as PUNCTUATION_BY_TASK_TYPE, TOLERANT_PUNCTUATIONS, taskTypeForPunctuation, } from '@senars/schemas/task';
import { stripTruthSuffix } from '@senars/types/truth';
import { errMsg } from '@senars/util/error';
import { SenarsError } from '@senars/errors';
import { TermFactory } from './factory';
import { Truth } from './Truth';
import { createLogger } from '../../util/logger';
const logger = createLogger({ scope: 'terms:impls:parser-peggy' });
const require = createRequire(import.meta.url);
const peggyModule = require('../peggy-generated.cjs');
const peggyParse = peggyModule.parse;
const log = {
    error: (msg, err) => logger.error(`[narsese] ${msg}`, err instanceof Error ? err : undefined),
};
/** The sentence mark each task kind is written with — the kernel's table, re-exported
 *  here because the grammar, not the wire, is where a Narsese task is punctuated. */
export { PUNCTUATION_BY_TASK_TYPE, taskTypeForPunctuation };
export class ParseError extends SenarsError {
    position;
    token;
    constructor(message, position, token, options) {
        super(`${message} at line ${position.line}, column ${position.column}`, 'PARSE_ERROR', {
            ...position,
            token,
        }, options);
        this.position = position;
        this.token = token;
        this.name = 'ParseError';
    }
}
export class TermParser {
    get termFactory() {
        return TermFactory;
    }
    parse(input) {
        const validInput = this._validateInput(input);
        try {
            const result = peggyParse(validInput, { termFactory: this.termFactory });
            if (result.term) {
                let term = result.term;
                if (result.operator === '--' &&
                    result.components?.length === 1 &&
                    result.truthValue) {
                    term = result.components[0];
                }
                return term;
            }
            return result;
        }
        catch (error) {
            logger.debug('[parser-peggy] caught error', { error: String(error) });
            throw this._wrapError(error, validInput);
        }
    }
    parseMultiple(input) {
        const statements = input.split(';');
        return statements
            .map((stmt) => stmt.trim())
            .filter((stmt) => stmt.length > 0 && !stmt.startsWith(';;'))
            .map((stmt) => {
            try {
                const result = this.parseWithTruth(stmt);
                return { term: result.term, truth: result.truth };
            }
            catch (error) {
                throw new SenarsError(`Failed to parse "${stmt}": ${errMsg(error)}`, 'PARSE_ERROR', { statement: stmt });
            }
        });
    }
    parseWithTruth(input) {
        const trimmed = input.trim();
        // What counts as a truth suffix, and where it ends, is @senars/util's
        // answer — this module used to hold a second copy of that grammar.
        const { text: body, truth: parsed } = stripTruthSuffix(trimmed);
        return {
            term: this.parse(body.replace(/[.!?@;]+$/, '').trim()),
            truth: parsed ? Truth.fromUnknown(parsed) : undefined,
        };
    }
    parseTask(input) {
        const trimmed = input?.trim?.() ?? '';
        if (!trimmed)
            return null;
        try {
            const result = peggyParse(trimmed, { termFactory: this.termFactory });
            const r = result;
            if (!r || !r.term || !r.punctuation)
                return null;
            const punc = r.punctuation;
            const taskType = punc ? taskTypeForPunctuation(punc) : null;
            if (!taskType)
                return null;
            const rawTruth = r.truthValue;
            const truth = rawTruth ? Truth.fromUnknown(rawTruth) : undefined;
            return { term: r.term, taskType, truth, punctuation: punc };
        }
        catch {
            return null;
        }
    }
    _validateInput(input) {
        if (typeof input !== 'string') {
            throw new SenarsError('Input must be a string', 'PARSE_ERROR');
        }
        if (input.trim() === '') {
            throw new SenarsError('Input must be a non-empty string', 'PARSE_ERROR');
        }
        return input.trim();
    }
    _wrapError(error, _input) {
        const location = error.location;
        const position = location
            ? {
                line: location.start?.line || 1,
                column: location.start?.column || 1,
                offset: location.start?.offset || 0,
            }
            : { line: 1, column: 1, offset: 0 };
        return new ParseError(`TermParser parsing failed: ${errMsg(error)}`, position, error);
    }
}
export const termParser = new TermParser();
export const deserializeTerm = (s) => {
    try {
        return termParser.parse(s);
    }
    catch (e) {
        log.error('Deserialize failed', e);
        return null;
    }
};
/**
 * Canonical Narsese string → Term API. Delegates to {@link deserializeTerm}.
 * Returns `null` when the input is not parseable.
 * @public
 */
export const fromNarsese = (s) => deserializeTerm(s);
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
export const parseTaskTolerant = (text) => {
    for (const punctuation of TOLERANT_PUNCTUATIONS) {
        const parsed = termParser.parseTask(`${text}${punctuation}`);
        if (parsed)
            return parsed;
    }
    return null;
};
