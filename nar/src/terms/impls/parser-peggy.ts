// senars Peggy parser wrapper
// This replaces the hand-written recursive descent parser

import { createRequire } from 'node:module';
import {
  TASK_PUNCTUATION as PUNCTUATION_BY_TASK_TYPE,
  type TaskPunctuation,
  type TaskType,
  TOLERANT_PUNCTUATIONS,
  taskTypeForPunctuation,
} from '@senars/core/schemas';
import { type BeliefTruth, createLogger, errMsg, stripTruthSuffix } from '@senars/util';
import { SenarsError } from '@senars/util/errors';
import type { Term } from '../types.js';
import { TermFactory } from './factory.js';
import { Truth } from './Truth.js';

const require = createRequire(import.meta.url);
const peggyModule: {
  parse: (input: string, options?: unknown) => unknown;
} = require('../peggy-generated.cjs');
const peggyParse = peggyModule.parse;

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

export class ParseError extends SenarsError {
  constructor(
    message: string,
    public position: ParserPosition,
    public token?: unknown,
    options?: ErrorOptions
  ) {
    super(
      `${message} at line ${position.line}, column ${position.column}`,
      'PARSE_ERROR',
      {
        ...position,
        token,
      },
      options
    );
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
      const result: unknown = peggyParse(validInput, { termFactory: this.termFactory });

      if ((result as any).term) {
        let term = (result as any).term as Term;

        if (
          (result as any).operator === '--' &&
          (result as any).components?.length === 1 &&
          (result as any).truthValue
        ) {
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
          return { term: result.term, truth: result.truth };
        } catch (error) {
          throw new Error(`Failed to parse "${stmt}": ${errMsg(error)}`);
        }
      });
  }

  parseWithTruth(input: string): { term: Term; truth?: Truth } {
    const trimmed = input.trim();

    // What counts as a truth suffix, and where it ends, is @senars/util's
    // answer — this module used to hold a second copy of that grammar.
    const { text: body, truth: parsed } = stripTruthSuffix(trimmed);

    return {
      term: this.parse(body.replace(/[.!?@;]+$/, '').trim()),
      truth: parsed ? Truth.fromUnknown(parsed) : undefined,
    };
  }

  parseTask(input: string): ParseTaskResult | null {
    const trimmed = input?.trim?.() ?? '';
    if (!trimmed) return null;

    try {
      const result: unknown = peggyParse(trimmed, { termFactory: this.termFactory });
      const r = result as {
        term?: Term;
        punctuation?: string;
        truthValue?: BeliefTruth;
      } | null;
      if (!r || !r.term || !r.punctuation) return null;

      const punc = r.punctuation;
      const taskType = punc ? taskTypeForPunctuation(punc) : null;
      if (!taskType) return null;

      const rawTruth = r.truthValue;
      const truth = rawTruth ? Truth.fromUnknown(rawTruth) : undefined;

      return { term: r.term, taskType, truth, punctuation: punc as ParseTaskResult['punctuation'] };
    } catch {
      return null;
    }
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
      : { line: 1, column: 1, offset: 0 };

    return new ParseError(`TermParser parsing failed: ${errMsg(error)}`, position, error);
  }
}

export const termParser = new TermParser();

const log = createLogger({ scope: 'narsese' });

export const deserializeTerm = (s: string): Term | null => {
  try {
    return termParser.parse(s);
  } catch (e) {
    log.error('Deserialize failed', e as Error);
    return null;
  }
};

/**
 * Canonical Narsese string → Term API. Delegates to {@link deserializeTerm}.
 * Returns `null` when the input is not parseable.
 * @public
 */
export const fromNarsese = (s: string): Term | null => deserializeTerm(s);

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
export const parseTaskTolerant = (text: string): ParseTaskResult | null => {
  for (const punctuation of TOLERANT_PUNCTUATIONS) {
    const parsed = termParser.parseTask(`${text}${punctuation}`);
    if (parsed) return parsed;
  }
  return null;
};
