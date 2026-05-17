// senars12 Peggy parser wrapper - based on senars11 design
// This replaces the hand-written recursive descent parser

import {TermFactory} from './factory.js';
import type {Term} from './types.js';
import {Truth} from './truth.js';
import {errMsg} from '../utils/index.js';
// @ts-ignore - Peggy generated module has no type declarations
import {parse as peggyParse} from './peggy-generated.js';

export interface ParserResult {
    term: Term;
    truth?: Truth;
    statements?: ParserResult[];
}

export interface ParserPosition {
    line: number;
    column: number;
    offset: number;
}

export class ParseError extends Error {
    constructor(
        message: string,
        public position: ParserPosition,
        public token?: unknown
    ) {
        super(`${message} at line ${position.line}, column ${position.column}`);
        this.name = 'ParseError';
    }
}

export class TermParser {
    private get termFactory() {
        return TermFactory;
    }

    parse(input: string): Term {
        const validInput = this._validateInput(input);

        try {
            const result: unknown = peggyParse(validInput, {termFactory: this.termFactory});

            if ((result as any).term) {
                let term = (result as any).term as Term;

                if ((result as any).operator === '--' && (result as any).components?.length === 1 && (result as any).truthValue) {
                    term = (result as any).components[0] as Term;
                }

                return term;
            }

            return result as Term;
        } catch (error: unknown) {
            throw this._wrapError(error, validInput);
        }
    }

    parseMultiple(input: string): ParserResult[] {
        const statements = input.split(';');
        return statements
            .map((stmt) => stmt.trim())
            .filter((stmt) => stmt.length > 0 && !stmt.startsWith(';;'))
            .map((stmt) => {
                try {
                    const result = this.parseWithTruth(stmt);
                    return {term: result.term, truth: result.truth};
                } catch (error) {
                    throw new Error(`Failed to parse "${stmt}": ${errMsg(error)}`);
                }
            });
    }

    parseWithTruth(input: string): { term: Term; truth?: Truth } {
        const trimmed = input.trim();

        const truthMatch = trimmed.match(/%\s*([0-9.]+)\s*;\s*([0-9.]+)\s*%\s*$/);
        const truth = truthMatch
            ? Truth.create(parseFloat(truthMatch[1] ?? '0.5'), parseFloat(truthMatch[2] ?? '0.9'))
            : undefined;
        let termStr = truthMatch ? trimmed.slice(0, -truthMatch[0].length).trim() : trimmed;

        termStr = termStr.replace(/[.!?@;]+\s*$/, '').trim();

        return {term: this.parse(termStr), truth};
    }

    private _validateInput(input: string): string {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }
        if (input.trim() === '') {
            throw new Error('Input must be a non-empty string');
        }
        return input.trim();
    }

    private _wrapError(error: unknown, _input: string): Error {
        const location = (error as any).location;
        const position: ParserPosition = location
            ? {
                line: location.start?.line || 1,
                column: location.start?.column || 1,
                offset: location.start?.offset || 0,
            }
            : {line: 1, column: 1, offset: 0};

        return new ParseError(`TermParser parsing failed: ${(error as Error).message}`, position, error);
    }
}

export const termParser = new TermParser();
