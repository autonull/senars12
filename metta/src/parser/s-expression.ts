type Whitespace = ' ' | '\t' | '\n' | '\r';

type Trim<S extends string> =
  S extends `${Whitespace}${infer R}` ? Trim<R> :
  S extends `${infer R}${Whitespace}` ? Trim<R> : S;

type ParseAtom<S extends string> =
  Trim<S> extends `$${infer Var}`
    ? { type: 'variable'; name: Var }
    : Trim<S> extends `${infer N extends number}`
      ? { type: 'number'; value: N }
      : { type: 'symbol'; value: Trim<S> };

type ParseList<S extends string, Acc extends readonly unknown[] = []> =
  Trim<S> extends ''
    ? Acc
    : Trim<S> extends `${infer Head} ${infer Tail}`
      ? ParseList<Tail, [...Acc, ParseAtom<Head>]>
      : [...Acc, ParseAtom<S>];

export type ParseSExpr<S extends string> =
  Trim<S> extends `(${infer Content})`
    ? { type: 'expression'; items: ParseList<Content> }
    : ParseAtom<S>;
