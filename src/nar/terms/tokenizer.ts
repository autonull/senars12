/**
 * Term tokenizer - extracts tokens from input strings
 */

const WHITESPACE = /\s/;
const OPERATORS = /[()&|~<->=]/;

export type TokenType =
  | 'ATOM'
  | 'VARIABLE'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'TRUTH_START'
  | 'TRUTH_END'
  | 'SEMICOLON'
  | 'COMMENT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const pushToken = (type: TokenType, value: string, offset: number) => {
    tokens.push({type, value, position: offset});
  };

  while (i < input.length) {
    const ch = input.charAt(i);

    if (ch === '\n') {
      line++;
      column = 1;
    } else if (!WHITESPACE.test(ch)) {
      column++;
    }

    if (WHITESPACE.test(ch)) {
      i++;
      continue;
    }

    if (i + 1 < input.length && input.substring(i, i + 2) === ';;') {
      i += 2;
      while (i < input.length && input.charAt(i) !== '\n') {
        i++;
      }
      continue;
    }

    if (ch === '(') {
      pushToken('LPAREN', '(', i);
      i++;
      continue;
    }
    if (ch === ')') {
      pushToken('RPAREN', ')', i);
      i++;
      continue;
    }
    if (ch === ',') {
      pushToken('COMMA', ',', i);
      i++;
      continue;
    }
    if (ch === ';') {
      pushToken('SEMICOLON', ';', i);
      i++;
      continue;
    }
    if (ch === '%') {
      pushToken('TRUTH_START', '%', i);
      i++;
      continue;
    }
    if (i + 2 < input.length) {
      const three = input.substring(i, i + 3);
      if (three === '-->') {
        pushToken('OP', '-->', i);
        i += 3;
        continue;
      }
      if (three === '<->') {
        pushToken('OP', '<->', i);
        i += 3;
        continue;
      }
      if (three === '<=>') {
        pushToken('OP', '<=>', i);
        i += 3;
        continue;
      }
    }
    if (i + 1 < input.length) {
      const two = input.substring(i, i + 2);
      if (two === '--') {
        pushToken('OP', '--', i);
        i += 2;
        continue;
      }
      if (two === '=>') {
        pushToken('OP', '=>', i);
        i += 2;
        continue;
      }
    }
    if (ch === '&') {
      pushToken('OP', '&', i);
      i++;
      continue;
    }
    if (ch === '|') {
      pushToken('OP', '|', i);
      i++;
      continue;
    }
    if (ch === '$') {
      let varname = '$';
      i++;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input.charAt(i))) {
        varname += input.charAt(i);
        i++;
      }
      pushToken('VARIABLE', varname, i - varname.length);
      continue;
    }
    let atom = '';
    const atomStart = i;
    while (i < input.length) {
      const c = input.charAt(i);
      if (OPERATORS.test(c) || WHITESPACE.test(c) || c === '%' || c === ';' || c === ',') break;
      atom += c;
      i++;
    }
    if (atom.length) pushToken('ATOM', atom, atomStart);
  }
  pushToken('EOF', '', i);
  return tokens;
};
