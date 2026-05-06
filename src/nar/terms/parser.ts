import { TermFactory } from './factory.js';
import type { Term } from './types.js';
import { Truth } from './truth.js';

type TokenType = 'ATOM' | 'VARIABLE' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'TRUTH_START' | 'TRUTH_END' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

const WHITESPACE = /\s/;
const OPERATORS = /[()&|~<->=]/;

export class TermParser {
  private pos = 0;
  private tokens: Token[] = [];

  parse(input: string): Term {
    this.tokens = this.tokenize(input.trim());
    this.pos = 0;
    return this.parseTerm();
  }

  parseWithTruth(input: string): { term: Term; truth?: Truth } {
    const trimmed = input.trim();
    const truthMatch = trimmed.match(/%\s*([0-9.]+)\s*;\s*([0-9.]+)\s*%\s*$/);
    const truth = truthMatch ? Truth.create(parseFloat(truthMatch[1] ?? '0.5'), parseFloat(truthMatch[2] ?? '0.9')) : undefined;
    const termStr = truthMatch ? trimmed.slice(0, -truthMatch[0].length).trim() : trimmed;
    return { term: this.parse(termStr), truth };
  }

  private tokenize(s: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < s.length) {
      const ch = s.charAt(i);
      if (WHITESPACE.test(ch)) { i++; continue; }
      if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
      if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
      if (ch === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }
      if (ch === '%') { tokens.push({ type: 'TRUTH_START', value: '%' }); i++; continue; }
      if (i + 1 < s.length && s.substring(i, i + 2) === '--') { tokens.push({ type: 'OP', value: '--' }); i += 2; continue; }
      if (i + 2 < s.length) {
        const three = s.substring(i, i + 3);
        if (three === '-->') { tokens.push({ type: 'OP', value: '-->' }); i += 3; continue; }
        if (three === '<->') { tokens.push({ type: 'OP', value: '<->' }); i += 3; continue; }
        if (three === '<=>') { tokens.push({ type: 'OP', value: '<=>' }); i += 3; continue; }
      }
      if (i + 1 < s.length) {
        const two = s.substring(i, i + 2);
        if (two === '=>') { tokens.push({ type: 'OP', value: '=>' }); i += 2; continue; }
      }
      if (ch === '&') { tokens.push({ type: 'OP', value: '&' }); i++; continue; }
      if (ch === '|') { tokens.push({ type: 'OP', value: '|' }); i++; continue; }
      if (ch === '$') {
        let varname = '$';
        i++;
        while (i < s.length && /[a-zA-Z0-9_]/.test(s.charAt(i))) {
          varname += s.charAt(i);
          i++;
        }
        tokens.push({ type: 'VARIABLE', value: varname });
        continue;
      }
      let atom = '';
      while (i < s.length) {
        const c = s.charAt(i);
        if (OPERATORS.test(c) || WHITESPACE.test(c) || c === '%' || c === ';') break;
        atom += c;
        i++;
      }
      if (atom.length) tokens.push({ type: 'ATOM', value: atom });
    }
    tokens.push({ type: 'EOF', value: '' });
    return tokens;
  }

  private at(index: number): Token {
    const t = this.tokens[index];
    return t ?? { type: 'EOF', value: '' };
  }

  private isOp(token: Token): boolean {
    return token.type === 'OP';
  }

  private parseTerm(): Term {
    const t = this.at(this.pos);
    if (t.type === 'EOF') throw new Error('Unexpected end of input');
    if (t.type === 'VARIABLE') {
      this.pos++;
      return TermFactory.atom(t.value);
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
        throw new Error('Expected RPAREN');
      }
      this.pos++;
      return inner;
    }
    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
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
      case '-->': return TermFactory.inheritance(first, second);
      case '<->': return TermFactory.similarity(first, second);
      case '=>': return TermFactory.implication(first, second);
      case '<=>': return TermFactory.equivalence(first, second);
      case '&': return TermFactory.conjunction(...terms);
      case '|': return TermFactory.disjunction(...terms);
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }
}

export const termParser = new TermParser();
