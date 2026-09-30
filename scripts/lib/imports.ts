/**
 * Module-specifier extraction, by masking rather than by parsing.
 *
 * A regex over raw source cannot tell an import from the same text inside a
 * template literal or a comment, and this repository contains both:
 * `nar/src/tools/adapters/test-gen.ts` emits
 * `import { XSchema } from '@senars/nar/tools/schemas'` as *generated text*,
 * and half a dozen files name their own package in a doc comment. A gate built
 * on the naive regex reports those, and a gate that cries wolf is a gate people
 * stop reading.
 *
 * `maskNonCode` blanks every region that cannot contain a module specifier —
 * comments, and the body of a template literal including any nested `${}`
 * expression — while leaving quoted strings intact so the specifier itself
 * survives. The regexes then run over the mask, which has the same length and
 * line structure as the source, so every offset still points at the original.
 *
 * No TypeScript parser is used deliberately: `typescript@7` exposes no compiler
 * API and `typescript-eslint` refuses to run against it. This is a lexical
 * question, not a syntactic one, and lexical is enough.
 */

/** Blanks comments and template-literal bodies, preserving length and newlines. */
export const maskNonCode = (source: string): string => {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = Math.max(0, from); i < Math.min(to, out.length); i++) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };
  const lineEnd = (from: number): number => {
    const end = source.indexOf('\n', from);
    return end === -1 ? source.length : end;
  };
  const blockEnd = (from: number): number => {
    const end = source.indexOf('*/', from + 2);
    return end === -1 ? source.length : end + 2;
  };
  const quotedEnd = (from: number): number => {
    const quote = source[from];
    let i = from + 1;
    while (i < source.length) {
      if (source[i] === '\\') {
        i += 2;
        continue;
      }
      if (source[i] === quote) return i + 1;
      i++;
    }
    return source.length;
  };

  type Mode = 'code' | 'template';
  let mode: Mode = 'code';
  /** Depth of `${ … }` nesting: the code inside an interpolation still counts braces. */
  let interpolation = 0;
  let i = 0;

  while (i < source.length) {
    const char = source[i] as string;
    const next = source[i + 1];

    if (mode === 'code') {
      if (char === '/' && next === '/') {
        const stop = lineEnd(i);
        blank(i, stop);
        i = stop;
      } else if (char === '/' && next === '*') {
        const stop = blockEnd(i);
        blank(i, stop);
        i = stop;
      } else if (char === "'" || char === '"') {
        i = quotedEnd(i);
      } else if (char === '`') {
        mode = 'template';
        i++;
      } else if (interpolation > 0 && char === '{') {
        interpolation++;
        i++;
      } else if (interpolation > 0 && char === '}') {
        interpolation--;
        i++;
        if (interpolation === 0) mode = 'template';
      } else {
        i++;
      }
      continue;
    }

    // In a template literal: `\` escapes, `` ` `` closes, `${` re-enters code.
    if (char === '\\') {
      blank(i, i + 2);
      i += 2;
      continue;
    }
    if (char === '`') {
      mode = 'code';
      i++;
      continue;
    }
    if (char === '$' && next === '{') {
      blank(i, i + 2);
      interpolation++;
      mode = 'code';
      i += 2;
      continue;
    }
    blank(i, i + 1);
    i++;
  }

  return out.join('');
};

export interface ImportEdge {
  specifier: string;
  /** `import('…')` — a value edge at runtime, and the shape the last inversion wore. */
  dynamic: boolean;
  /** Byte offset in the source, so a violation can name a line. */
  offset: number;
}

const SPECIFIER = "['\"]([^'\"]+)['\"]";

/**
 * Every module specifier a file loads — static, side-effect, and dynamic.
 * Type-only and value imports are not distinguished: the gate reads the layer
 * order off a manifest, and a type-only import that points upward is still an
 * upward edge. Nothing in the tree needs the exemption.
 */
export const importEdges = (source: string): ImportEdge[] => {
  const mask = maskNonCode(source);
  const edges: ImportEdge[] = [];
  const seen = new Set<number>();

  const add = (specifier: string | undefined, offset: number, dynamic: boolean): void => {
    if (!specifier || seen.has(offset)) return;
    seen.add(offset);
    edges.push({ specifier, dynamic, offset });
  };

  for (const m of mask.matchAll(new RegExp(String.raw`\bimport\s*\(\s*${SPECIFIER}`, 'g'))) {
    add(m[1], m.index, true);
  }
  for (const m of mask.matchAll(new RegExp(String.raw`\bimport\s+${SPECIFIER}`, 'g'))) {
    add(m[1], m.index, false);
  }
  // `import { A } from 'x'`, `import type { A } from 'x'`, `export … from 'x'`.
  for (const m of mask.matchAll(
    new RegExp(String.raw`\b(?:import|export)\b[^;]*?\bfrom\s*${SPECIFIER}`, 'g')
  )) {
    add(m[1], m.index, false);
  }

  return edges.sort((a, b) => a.offset - b.offset);
};
