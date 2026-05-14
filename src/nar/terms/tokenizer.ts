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

const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
    '(' : 'LPAREN', ')' : 'RPAREN', ',' : 'COMMA', ';' : 'SEMICOLON', '%' : 'TRUTH_START',
    '&' : 'OP', '|' : 'OP',
};

export const tokenize = (input: string): Token[] => {
    const tokens: Token[] = [];
    let i = 0;

    const pushToken = (type: TokenType, value: string, offset: number) => {
        tokens.push({type, value, position: offset});
    };

    while (i < input.length) {
        const ch = input.charAt(i);

        if (ch === '\n') {
            i++;
            continue;
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

        if (ch in SINGLE_CHAR_TOKENS) {
            pushToken(SINGLE_CHAR_TOKENS[ch]!, ch, i);
            i++;
            continue;
        }

        let matchedOp = '';
        for (const op of ['<->', '<=>', '-->', '--', '=>']) {
            if (input.substring(i, i + op.length) === op) {
                matchedOp = op;
                break;
            }
        }
        if (matchedOp) {
            pushToken('OP', matchedOp, i);
            i += matchedOp.length;
            continue;
        }

        if (ch === '$') {
            let varname = '$';
            i++;
            while (i < input.length && /[a-zA-Z0-9_]/.test(input.charAt(i))) {
                varname += input.charAt(i++);
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
