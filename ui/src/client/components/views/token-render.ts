import { css, html, type TemplateResult } from 'lit';
import { tokenizeCode } from './code-highlight.js';

/** Shared token palette for `s-code` and `s-diff`; the highlight lives in the light DOM of neither. */
export const highlightStyles = css`
  .comment { color: var(--colors-semantic-text-muted); font-style: italic; }
  .string { color: var(--colors-semantic-accent-cyan); }
  .number { color: var(--colors-semantic-accent-violet); }
  .keyword { color: var(--colors-semantic-accent-primary); }
`;

/** Map one code line to highlighted spans; plain runs pass through untouched. */
export const highlightLine = (text: string, language?: string): TemplateResult =>
  html`${tokenizeCode(text, language).map((token) =>
    token.kind === 'plain' ? token.text : html`<span class=${token.kind}>${token.text}</span>`
  )}`;
