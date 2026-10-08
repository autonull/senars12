/**
 * Line-local code tokenizer for `s-code` (§4.3). Deliberately small and
 * deterministic — strings, comments, numbers and keywords — so highlighting is
 * a plain function over one line, with no grammar, parser or state carried
 * across lines. Tuned for the languages that surface as `code` blocks.
 */

export type CodeTokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword';

export interface CodeToken {
  readonly text: string;
  readonly kind: CodeTokenKind;
}

const KEYWORDS = new Set([
  'abstract',
  'and',
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'elif',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'is',
  'lambda',
  'let',
  'match',
  'module',
  'namespace',
  'new',
  'None',
  'not',
  'null',
  'of',
  'or',
  'pass',
  'private',
  'protected',
  'public',
  'raise',
  'readonly',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'var',
  'while',
  'with',
  'yield',
]);

/** Languages whose line comments start with `#` rather than `//`. */
const HASH_COMMENT = /^(py|python|sh|bash|zsh|rb|ruby|yaml|yml|toml|r|perl|pl|make|docker)/i;

const SOURCE = (comment: string): string =>
  `("(?:\\\\.|[^"\\\\])*"?|'(?:\\\\.|[^'\\\\])*'?|\`(?:\\\\.|[^\`\\\\])*\`?)` +
  `|(${comment})` +
  `|(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?)` +
  `|([A-Za-z_$][\\w$]*)`;

/** Tokenize a single line into classified spans; adjacent plain runs merge. */
export function tokenizeCode(line: string, language?: string): CodeToken[] {
  const comment = HASH_COMMENT.test(language ?? '') ? '#[^\\n]*' : '\\/\\/[^\\n]*';
  const pattern = new RegExp(SOURCE(comment), 'gi');
  const tokens: CodeToken[] = [];
  const push = (text: string, kind: CodeTokenKind): void => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last?.kind === 'plain' && kind === 'plain') {
      tokens[tokens.length - 1] = { text: last.text + text, kind };
    } else {
      tokens.push({ text, kind });
    }
  };
  let index = 0;
  for (const match of line.matchAll(pattern)) {
    const at = match.index ?? 0;
    push(line.slice(index, at), 'plain');
    const [text, string, commentText, number, ident] = match;
    if (string !== undefined) push(text, 'string');
    else if (commentText !== undefined) push(text, 'comment');
    else if (number !== undefined) push(text, 'number');
    else if (ident !== undefined) push(text, KEYWORDS.has(ident) ? 'keyword' : 'plain');
    index = at + text.length;
  }
  push(line.slice(index), 'plain');
  return tokens;
}
