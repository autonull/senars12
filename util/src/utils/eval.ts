/**
 * Safe arithmetic expression evaluator — a non-eval replacement for `new Function()` math.
 * Supports +, -, *, /, %, unary ±, parentheses, and decimal literals. No identifiers,
 * no property access, no calls: the grammar is closed, so no input can escape it.
 */
export class ExpressionError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

const enum T {
  Num,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  LParen,
  RParen,
  End,
}

interface Token {
  type: T;
  value: number;
  pos: number;
}

const PUNCT: Record<string, T> = {
  '+': T.Plus,
  '-': T.Minus,
  '*': T.Star,
  '/': T.Slash,
  '%': T.Percent,
  '(': T.LParen,
  ')': T.RParen,
};

class Tokenizer {
  readonly tokens: Token[] = [];
  private i = 0;

  constructor(private readonly src: string) {}

  run(): Token[] {
    while (this.i < this.src.length) {
      const c = this.src[this.i]!;
      if (c === ' ' || c === '\t') {
        this.i++;
        continue;
      }
      const pos = this.i;
      if (c >= '0' && c <= '9') {
        let j = this.i;
        while (j < this.src.length && ((this.src[j]! >= '0' && this.src[j]! <= '9') || this.src[j] === '.')) j++;
        const num = Number(this.src.slice(this.i, j));
        if (!Number.isFinite(num)) throw new ExpressionError(`Invalid number at ${pos}`, pos);
        this.tokens.push({ type: T.Num, value: num, pos });
        this.i = j;
        continue;
      }
      const type = PUNCT[c];
      if (type === undefined) throw new ExpressionError(`Unexpected character '${c}' at ${pos}`, pos);
      this.tokens.push({ type, value: 0, pos });
      this.i++;
    }
    this.tokens.push({ type: T.End, value: 0, pos: this.src.length });
    return this.tokens;
  }
}

/** Evaluate an arithmetic expression; throws `ExpressionError` on malformed input. */
export function evaluateExpression(expression: string): number {
  const tokens = new Tokenizer(expression).run();
  let next = 0;
  const peek = (): Token => tokens[next] ?? { type: T.End, value: 0, pos: expression.length };
  const advance = (): Token => peek() && tokens[next++]!;

  const primary = (): number => {
    const t = advance();
    if (t.type === T.Num) return t.value;
    if (t.type === T.Minus) return -primary();
    if (t.type === T.Plus) return primary();
    if (t.type === T.LParen) {
      const v = additive();
      if (advance().type !== T.RParen) throw new ExpressionError(`Expected ')' at ${t.pos}`, t.pos);
      return v;
    }
    throw new ExpressionError(`Unexpected token at ${t.pos}`, t.pos);
  };

  const multiplicative = (): number => {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t.type === T.Star) {
        advance();
        left *= primary();
      } else if (t.type === T.Slash) {
        advance();
        left /= primary();
      } else if (t.type === T.Percent) {
        advance();
        left %= primary();
      } else return left;
    }
  };

  const additive = (): number => {
    let left = multiplicative();
    for (;;) {
      const t = peek();
      if (t.type === T.Plus) {
        advance();
        left += multiplicative();
      } else if (t.type === T.Minus) {
        advance();
        left -= multiplicative();
      } else return left;
    }
  };

  const result = additive();
  const end = peek();
  if (end.type !== T.End) throw new ExpressionError(`Unexpected token at ${end.pos}`, end.pos);
  if (!Number.isFinite(result)) throw new ExpressionError('Non-finite result', 0);
  return result;
}
