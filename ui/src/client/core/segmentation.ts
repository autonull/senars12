/**
 * Deterministic output segmentation (§9.1): Markdown is an interchange format,
 * not the substrate, so streaming text is parsed into typed semantic blocks —
 * headings, paragraphs, lists, tables, fenced code — before it enters the
 * WorkspaceGraph. The parser is deterministic and dependency-free (no `marked`)
 * so the same text yields the same blocks in tests and under streaming reparse;
 * block ids are assigned by the caller from the position anchor. Unknown
 * constructs degrade to paragraphs, never to lost text.
 */

import type { BlockKind } from './workspace-graph.js';

/** A parsed segment before the caller assigns ids, role and provenance. */
export interface Segment {
  kind: BlockKind;
  text: string;
  /** Heading depth. */
  level?: number;
  /** Fenced-code language. */
  lang?: string;
  /** Structured payload for `table` (headers/rows) and `code` (language). */
  data?: unknown;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

/** Typed payloads a `Segment`/`SemanticBlock` can carry, keyed by its `kind` (§4.3). */
export interface CodeData {
  lang?: string;
}
export interface ListData {
  items: string[];
}
export interface ImageData {
  alt: string;
  src: string;
  width?: number;
  height?: number;
}
export interface CitationData {
  label?: string;
  key?: string;
  href: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The typed accessors that replace the per-consumer `data as …` casts (§4.3). */
export const asTableData = (data: unknown): TableData | undefined =>
  isRecord(data) && Array.isArray(data.headers) && Array.isArray(data.rows)
    ? { headers: data.headers as string[], rows: data.rows as string[][] }
    : undefined;

export const asCodeData = (data: unknown): CodeData | undefined =>
  isRecord(data) && (data.lang === undefined || typeof data.lang === 'string')
    ? { lang: data.lang as string | undefined }
    : undefined;

export const asListData = (data: unknown): ListData | undefined =>
  isRecord(data) && Array.isArray(data.items) && data.items.every((item) => typeof item === 'string')
    ? { items: data.items as string[] }
    : undefined;

export const asImageData = (data: unknown): ImageData | undefined =>
  isRecord(data) && typeof data.src === 'string'
    ? {
        alt: typeof data.alt === 'string' ? data.alt : '',
        src: data.src,
        width: typeof data.width === 'number' ? data.width : undefined,
        height: typeof data.height === 'number' ? data.height : undefined,
      }
    : undefined;

export const asCitationData = (data: unknown): CitationData | undefined =>
  isRecord(data) && typeof data.href === 'string'
    ? {
        label: typeof data.label === 'string' ? data.label : undefined,
        key: typeof data.key === 'string' ? data.key : undefined,
        href: data.href,
      }
    : undefined;

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*```(\w*)\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;
const BLOCKQUOTE = /^\s*>\s?(.*)$/;
const SEPARATOR = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;
// Standalone Markdown image / link, and reference-style link definition.
const IMAGE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)\s*$/;
const LINK = /^\[([^\]]+)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)\s*$/;
const LINK_DEFINITION = /^\[([^\]]+)\]:\s*(\S+)\s*$/;

const isBlank = (line: string): boolean => line.trim() === '';
const hasPipe = (line: string): boolean => line.includes('|');

const splitRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
};

const startsBlock = (line: string): boolean =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  LIST_ITEM.test(line) ||
  BLOCKQUOTE.test(line) ||
  IMAGE.test(line) ||
  LINK.test(line) ||
  LINK_DEFINITION.test(line);

function parseTable(lines: readonly string[], start: number): { segment: Segment; next: number } {
  const headers = splitRow(lines[start] ?? '');
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && hasPipe(lines[i] ?? '') && !isBlank(lines[i] ?? '')) {
    rows.push(splitRow(lines[i] ?? ''));
    i++;
  }
  return {
    segment: { kind: 'table', text: headers.join(' | '), data: { headers, rows } satisfies TableData },
    next: i,
  };
}

/** Segment Markdown-ish text into typed blocks, in document order. */
export function segmentText(text: string): Segment[] {
  const lines = text.split(/\r?\n/);
  const segments: Segment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const lang = fence[1] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] ?? '')) {
        body.push(lines[i] ?? '');
        i++;
      }
      i++;
      segments.push({ kind: 'code', text: body.join('\n'), lang, data: { lang } });
      continue;
    }

    if (HEADING.test(line)) {
      const match = HEADING.exec(line);
      segments.push({ kind: 'heading', text: match?.[2] ?? '', level: (match?.[1]?.length ?? 1) });
      i++;
      continue;
    }

    if (hasPipe(line) && SEPARATOR.test(lines[i + 1] ?? '')) {
      const { segment, next } = parseTable(lines, i);
      segments.push(segment);
      i = next;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i] ?? '')) {
        items.push(LIST_ITEM.exec(lines[i] ?? '')?.[1] ?? '');
        i++;
      }
      segments.push({ kind: 'list', text: items.join('\n'), data: { items } });
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(lines[i] ?? '')) {
        quoted.push(BLOCKQUOTE.exec(lines[i] ?? '')?.[1] ?? '');
        i++;
      }
      segments.push({ kind: 'paragraph', text: quoted.join('\n') });
      continue;
    }

    const image = IMAGE.exec(line);
    if (image) {
      const alt = image[1] ?? '';
      const src = image[2] ?? '';
      segments.push({ kind: 'image', text: alt, data: { alt, src } });
      i++;
      continue;
    }

    const linkDefinition = LINK_DEFINITION.exec(line);
    if (linkDefinition) {
      const key = linkDefinition[1] ?? '';
      const href = linkDefinition[2] ?? '';
      segments.push({ kind: 'citation', text: key, data: { key, href } });
      i++;
      continue;
    }

    const link = LINK.exec(line);
    if (link) {
      const label = link[1] ?? '';
      const href = link[2] ?? '';
      segments.push({ kind: 'citation', text: label, data: { label, href } });
      i++;
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i] ?? '') &&
      !startsBlock(lines[i] ?? '') &&
      !(hasPipe(lines[i] ?? '') && SEPARATOR.test(lines[i + 1] ?? ''))
    ) {
      paragraph.push(lines[i] ?? '');
      i++;
    }
    segments.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }

  return segments;
}
