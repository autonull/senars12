import {TermFactory} from './factory.js';
import type {Term} from './types.js';
import {Truth} from './truth.js';
import {errMsg} from '../utils';
import {type Token, tokenize} from './tokenizer.js';

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
        public token?: Token
    ) {
        super(`${message} at line ${position.line}, column ${position.column}`);
        this.name = 'ParseError';
    }
}

export class TermParser {
    private pos = 0;
    private tokens: Token[] = [];
    private variables: Set<string> = new Set();
    private boundVariables: Set<string> = new Set();

    parse(input: string): Term {
        this.tokens = tokenize(input.trim());
        this.pos = 0;
        this.variables.clear();
        this.boundVariables.clear();
        return this.parseTerm();
    }

    parseMultiple(input: string): ParserResult[] {
        const statements = input.split(';');
        return statements
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith(';;'))
            .map(stmt => {
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
        const truth = truthMatch ? Truth.create(parseFloat(truthMatch[1] ?? '0.5'), parseFloat(truthMatch[2] ?? '0.9')) : undefined;
        const termStr = truthMatch ? trimmed.slice(0, -truthMatch[0].length).trim() : trimmed;
        return {term: this.parse(termStr), truth};
    }

    validateVariableScoping(): void {
        const unbound = Array.from(this.variables).filter(v => !this.boundVariables.has(v));
        if (unbound.length > 0) {
            throw new ParseError(
                `Unbound variables detected: ${unbound.join(', ')}. Use $?${unbound[0]?.replace('$', '')} for bound variables.`,
                {line: 1, column: 1, offset: 0}
            );
        }
    }

    bindVariable(varName: string): void {
        this.boundVariables.add(varName);
    }

    clearBindings(): void {
        this.variables.clear();
        this.boundVariables.clear();
    }

    private at(index: number): Token {
        const t = this.tokens[index];
        return t ?? {type: 'EOF', value: '', position: 0};
    }

    private isOp(token: Token): boolean {
        return token.type === 'OP';
    }

    private getPosition(token?: Token): ParserPosition {
        const pos = token?.position ?? this.tokens[this.pos - 1]?.position ?? 0;
        let line = 1;
        let column = 1;
        for (let i = 0; i < pos; i++) {
            if (this.tokens[i]?.value === '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }
        return {line, column, offset: pos};
    }

    private parseTerm(): Term {
        const t = this.at(this.pos);
        if (t.type === 'EOF') {
            throw new ParseError('Unexpected end of input', this.getPosition(t), t);
        }
        if (t.type === 'VARIABLE') {
            this.pos++;
            const varName = t.value;
            if (!this.boundVariables.has(varName) && !varName.startsWith('$?')) {
                this.variables.add(varName);
            }
            return TermFactory.atom(varName);
        }
        if (t.type === 'ATOM') {
            this.pos++;
            return TermFactory.atom(t.value);
        }
        if (this.isOp(t) && t.value === '--') {
            this.pos++;
            return TermFactory.negation(this.parseTerm());
        }
        if (t.type === 'LPAREN') {
            this.pos++;
            const inner = this.parseCompoundOrAtomic();
            if (this.at(this.pos).type !== 'RPAREN') {
                const expectedPos = this.getPosition(this.at(this.pos));
                throw new ParseError('Expected closing parenthesis )', expectedPos, this.at(this.pos));
            }
            this.pos++;
            return inner;
        }
        const pos = this.getPosition(t);
        throw new ParseError(`Unexpected token: ${t.value || t.type}`, pos, t);
    }

    private parseCompoundOrAtomic(): Term {
        const terms: Term[] = [];
        let op: string | undefined;
        while (this.at(this.pos).type !== 'RPAREN' && this.at(this.pos).type !== 'EOF') {
            const t = this.at(this.pos);
            if (this.isOp(t)) {
                if (!op) {
                    op = t.value;
                    this.pos++;
                } else {
                    break;
                }
            } else if (t.type === 'COMMA') {
                this.pos++;
            } else if (t.type === 'ATOM' || t.type === 'VARIABLE' || t.type === 'LPAREN' || (this.isOp(t) && t.value === '--')) {
                terms.push(this.parseTerm());
            } else {
                break;
            }
        }
        if (!op) {
            return terms[0] ?? TermFactory.atom('TRUE');
        }
        if (terms.length === 1) return terms[0]!;
        const first = terms[0]!;
        const second = terms[1]!;
        switch (op) {
            case '-->':
                return TermFactory.inheritance(first, second);
            case '<->':
                return TermFactory.similarity(first, second);
            case '=>':
                return TermFactory.implication(first, second);
            case '<=>':
                return TermFactory.equivalence(first, second);
            case '&':
                return TermFactory.conjunction(...terms);
            case '|':
                return TermFactory.disjunction(...terms);
            default:
                const pos = this.getPosition(this.at(this.pos));
                throw new ParseError(`Unknown operator: ${op}`, pos, this.at(this.pos));
        }
    }
}

export const termParser = new TermParser();
