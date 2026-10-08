import { describe, expect, it } from 'vitest';
import {
  asCitationData,
  asCodeData,
  asImageData,
  asListData,
  asTableData,
  segmentText,
  type TableData,
} from '../../src/client/core/segmentation.js';

describe('output segmentation', () => {
  it('returns nothing for empty text', () => {
    expect(segmentText('')).toEqual([]);
    expect(segmentText('   \n\n  ')).toEqual([]);
  });

  it('parses headings with their depth', () => {
    const segments = segmentText('# Title\n\n### Deep');
    expect(segments).toEqual([
      { kind: 'heading', text: 'Title', level: 1 },
      { kind: 'heading', text: 'Deep', level: 3 },
    ]);
  });

  it('groups consecutive lines into one paragraph and splits on blank lines', () => {
    const segments = segmentText('first line\nsecond line\n\nnext paragraph');
    expect(segments).toEqual([
      { kind: 'paragraph', text: 'first line\nsecond line' },
      { kind: 'paragraph', text: 'next paragraph' },
    ]);
  });

  it('collects list items into one list block', () => {
    const segments = segmentText('- one\n- two\n1. three');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: 'list', data: { items: ['one', 'two', 'three'] } });
  });

  it('parses GitHub-style tables into headers and rows', () => {
    const segments = segmentText('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |');
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('table');
    expect(segments[0]?.data).toEqual({
      headers: ['a', 'b'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    } satisfies TableData);
  });

  it('captures fenced code with its language', () => {
    const segments = segmentText('intro\n\n```ts\nconst x = 1;\n```');
    expect(segments).toEqual([
      { kind: 'paragraph', text: 'intro' },
      { kind: 'code', text: 'const x = 1;', lang: 'ts', data: { lang: 'ts' } },
    ]);
  });

  it('preserves document order across mixed constructs', () => {
    const segments = segmentText('# H\n\ntext\n\n- a\n- b\n\n| x |\n| --- |\n| 1 |');
    expect(segments.map((s) => s.kind)).toEqual(['heading', 'paragraph', 'list', 'table']);
  });

  it('parses a standalone image line', () => {
    expect(segmentText('![a robin](https://x/y.png)')).toEqual([
      { kind: 'image', text: 'a robin', data: { alt: 'a robin', src: 'https://x/y.png' } },
    ]);
  });

  it('parses a standalone link as a citation', () => {
    expect(segmentText('[docs](https://x)')).toEqual([
      { kind: 'citation', text: 'docs', data: { label: 'docs', href: 'https://x' } },
    ]);
  });

  it('parses a reference link definition as a citation', () => {
    expect(segmentText('[1]: https://x')).toEqual([
      { kind: 'citation', text: '1', data: { key: '1', href: 'https://x' } },
    ]);
  });

  it('keeps an inline link inside its paragraph', () => {
    expect(segmentText('see [docs](https://x) here')).toEqual([
      { kind: 'paragraph', text: 'see [docs](https://x) here' },
    ]);
  });
});

describe('typed payload accessors (§4.3)', () => {
  it('narrows the payload a segment carries', () => {
    expect(asTableData(segmentText('| x |\n| --- |\n| 1 |')[0]?.data)).toEqual({
      headers: ['x'],
      rows: [['1']],
    });
    expect(asListData(segmentText('- a\n- b')[0]?.data)).toEqual({ items: ['a', 'b'] });
    expect(asCodeData(segmentText('```ts\nx\n```')[0]?.data)).toEqual({ lang: 'ts' });
    expect(asImageData(segmentText('![a](https://x/y.png)')[0]?.data)).toEqual({
      alt: 'a',
      src: 'https://x/y.png',
      width: undefined,
      height: undefined,
    });
    expect(asCitationData(segmentText('[docs](https://x)')[0]?.data)).toEqual({
      label: 'docs',
      key: undefined,
      href: 'https://x',
    });
  });

  it('rejects malformed payloads rather than casting', () => {
    expect(asTableData({ headers: 'x' })).toBeUndefined();
    expect(asListData({ items: [1, 2] })).toBeUndefined();
    expect(asImageData(null)).toBeUndefined();
    expect(asCitationData({})).toBeUndefined();
  });
});
