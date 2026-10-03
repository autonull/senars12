import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './root.js';

/** The production trees the surface is declared over. */
const SCAN_ROOTS = ['nar/src', 'src'] as const;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

/** Every production source file, repo-relative. One reader, so gate and test cannot disagree. */
export const scanSubject = (): SurfaceSubject => ({
  files: SCAN_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root))).map((path) => ({
    path: path.slice(ROOT.length + 1),
    source: readFileSync(path, 'utf8'),
  })),
});

/**
 * The attention write surface: who may write `Concept.priority`, and what else
 * the attention owner is allowed to do to it (TODO29.a §5.4).
 *
 * **The compiler holds the primary invariant and this holds the rest.** A public
 * setter is what made "ten external and six internal writers" possible, and it
 * is gone, so `concept.priority = x` no longer compiles. What a compiler cannot
 * see is the *rest* of the acceptance: which reasons exist, which one each
 * writer uses, that the decay sweep has exactly one call site, and that the two
 * read paths contain no write at all. Those are properties of the tree's text,
 * so they are read from the text.
 *
 * Pure verdict logic, one predicate per rule, so a failing rule reads as a
 * sentence about the tree rather than a stack trace out of a scanner.
 */

/** Every reason {@link Concept.writeAttention} must accept. */
export const ATTENTION_REASONS = [
  'input',
  'prime',
  'related',
  'decay',
  'self-tune',
  'assign',
  'merge',
] as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export interface WriteSite {
  /** Repo-relative `file:line`. */
  readonly at: string;
  /** The reason the site writes with. */
  readonly reason: string;
}

/** The one module allowed to touch a concept's priority outside the write surface. */
export const ATTENTION_OWNER = 'nar/src/memory/concept.ts';

/** Where the reads and the decay sweep live; both rules are about this one file. */
export const MEMORY_OWNER = 'nar/src/memory/memory.ts';

/** Repo-relative source text for every scanned file — the gate's and the test's shared input. */
export interface SurfaceFile {
  readonly path: string;
  readonly source: string;
}

export interface SurfaceSubject {
  /** Repo-relative source paths, scanned for the rules below. */
  readonly files: readonly SurfaceFile[];
}

/** `concept.priority = …` anywhere at all — a setter assignment the compiler would reject. */
const PRIORITY_ASSIGNMENT = /\.priority\s*(=[^=]|\+=|-=|\*=|\/=)/;

/** `concept.writeAttention({ reason: … })` — the sanctioned shape. */
const WRITE_ATTENTION = /writeAttention\(\{\s*reason:\s*'([a-z-]+)'/g;

export interface SurfaceViolation {
  readonly rule: string;
  readonly at: string;
  readonly detail: string;
}

/** Every `writeAttention` call in the tree, paired with the reason it names. */
export const writeSites = ({ files }: SurfaceSubject): WriteSite[] =>
  files.flatMap(({ path, source }) =>
    [...source.matchAll(WRITE_ATTENTION)].map((match) => ({
      at: `${path}:${source.slice(0, match.index).split('\n').length}`,
      reason: match[1] ?? '',
    }))
  );

/**
 * The setter itself. The compiler rejects `concept.priority = x` in every other
 * module; what it cannot reject is the setter coming *back*, and a `set
 * priority` in the owner is invisible to any other rule here. So the gate reads
 * the owner's own declarations: a getter and no setter.
 */
const setterViolations = ({ files }: SurfaceSubject): SurfaceViolation[] =>
  files
    .filter(({ path }) => path === ATTENTION_OWNER)
    .flatMap(({ source }) =>
      /\bset\s+priority\b/.test(source)
        ? [
            {
              rule: 'priority-setter-present',
              at: ATTENTION_OWNER,
              detail: '`set priority` re-opens the write surface A4 closed',
            },
          ]
        : /\bget\s+priority\b/.test(source)
          ? []
          : [
              {
                rule: 'priority-not-readable',
                at: ATTENTION_OWNER,
                detail: '`get priority` is gone — attention has no reader',
              },
            ]
    );

/** A reason nothing writes, or a write naming a reason the union does not have. */
const reasonViolations = ({ files }: SurfaceSubject): SurfaceViolation[] => {
  const known = new Set<string>(ATTENTION_REASONS);
  const used = writeSites({ files }).map((site) => site.reason);
  return [
    ...used
      .filter((reason) => !known.has(reason))
      .map((reason) => ({
        rule: 'unknown-reason',
        at: 'nar/src/memory/concept.ts',
        detail: `'${reason}' is written with but is not a member of AttentionEvent`,
      })),
    ...ATTENTION_REASONS.filter((reason) => !used.includes(reason)).map((reason) => ({
      rule: 'dead-reason',
      at: 'nar/src/memory/concept.ts',
      detail: `'${reason}' is in AttentionEvent and nothing writes it`,
    })),
  ];
};

/** The body of one method, by brace matching from its declaration. */
export const methodBody = (source: string, name: string): string => {
  const start = source.indexOf(`${name}(`);
  if (start < 0) return '';
  let depth = 0;
  let opened = false;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const char = source[i];
    if (char === '{') {
      depth++;
      opened = true;
    } else if (char === '}') {
      depth--;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
};

/** The two read paths must contain no write at all — a read that mutates is finding 1. */
const readPurityViolations = ({ files }: SurfaceSubject): SurfaceViolation[] =>
  ['topConcepts', 'sampleWindow'].flatMap((name) =>
    files
      .filter(({ path }) => path === MEMORY_OWNER)
      .flatMap(({ path, source }) => {
        const body = methodBody(source, name);
        if (!body) return [];
        const offending = ['decayAll', 'writeAttention', 'consolidate', 'boost('].filter((token) =>
          body.includes(token)
        );
        return offending.map((token) => ({
          rule: 'read-writes',
          at: path,
          detail: `${name}() calls \`${token}\` — reads are observational`,
        }));
      })
  );

/** One sweep, one call site: decay is the clock's, not a read's or a caller's. */
const clockViolations = ({ files }: SurfaceSubject): SurfaceViolation[] => {
  const sweep = files.find(({ path }) => path === MEMORY_OWNER)?.source ?? '';
  const declared = sweep.includes('private decayAll(');
  const callers = [...sweep.matchAll(/(?<!private )decayAll\(/g)].map(
    (match) => sweep.slice(0, match.index).split('\n').length
  );
  return [
    ...(declared
      ? []
      : [{ rule: 'no-decay-sweep', at: MEMORY_OWNER, detail: '`decayAll` is not declared' }]),
    ...(callers.length === 1
      ? []
      : [
          {
            rule: 'decay-call-site-count',
            at: MEMORY_OWNER,
            detail: `the decay sweep has ${callers.length} call sites: ${
              callers.map((line) => `${MEMORY_OWNER}:${line}`).join(', ') || 'none'
            } — consolidation is the only one`,
          },
        ]),
  ];
};

export const surfaceViolations = (subject: SurfaceSubject): SurfaceViolation[] => [
  ...setterViolations(subject),
  ...reasonViolations(subject),
  ...readPurityViolations(subject),
  ...clockViolations(subject),
];
