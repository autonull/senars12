/**
 * Inline rich text (§1.4): the small, safe subset of Markdown that appears
 * inside a paragraph, heading or list item — code spans, links, bold and
 * emphasis — plus `[n]` citation references, which the renderer resolves against
 * the bibliography (`citations.ts`) instead of rendering as literal text. This is
 * a pure tokenizer so the Notebook renders the tokens as Lit templates (no
 * `innerHTML`), unlike the chat panel's `marked` + sanitize path.
 */

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'citation'; key: string };

// The link alternative precedes the citation one so `[label](href)` stays a link.
const INLINE_PATTERN =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\[\]\s]+)\]|\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_/g;

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (let match = INLINE_PATTERN.exec(text); match; match = INLINE_PATTERN.exec(text)) {
    if (match.index > last) tokens.push({ type: 'text', value: text.slice(last, match.index) });
    const [, code, linkLabel, linkHref, citationKey, strong, em, underscore] = match;
    if (code !== undefined) tokens.push({ type: 'code', value: code });
    else if (linkLabel !== undefined)
      tokens.push({ type: 'link', value: linkLabel, href: linkHref ?? '' });
    else if (citationKey !== undefined) tokens.push({ type: 'citation', key: citationKey });
    else if (strong !== undefined) tokens.push({ type: 'strong', value: strong });
    else if (em !== undefined) tokens.push({ type: 'em', value: em });
    else if (underscore !== undefined) tokens.push({ type: 'em', value: underscore });
    last = INLINE_PATTERN.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}
