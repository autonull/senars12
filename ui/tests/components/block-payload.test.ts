import { describe, expect, it } from 'vitest';
import { payloadOf } from '../../src/client/core/block-payload.js';
import { segmentText } from '../../src/client/core/segmentation.js';

describe('typed block payloads (§4.3)', () => {
  it('narrows the payload a segment carries', () => {
    expect(payloadOf(segmentText('| x |\n| --- |\n| 1 |')[0]?.data, 'table')).toEqual({
      headers: ['x'],
      rows: [['1']],
    });
    expect(payloadOf(segmentText('- a\n- b')[0]?.data, 'list')).toEqual({ items: ['a', 'b'] });
    expect(payloadOf(segmentText('```ts\nx\n```')[0]?.data, 'code')).toEqual({ lang: 'ts' });
    expect(payloadOf(segmentText('![a](https://x/y.png)')[0]?.data, 'image')).toEqual({
      alt: 'a',
      src: 'https://x/y.png',
      width: undefined,
      height: undefined,
    });
    expect(payloadOf(segmentText('[1]: https://x')[0]?.data, 'citation')).toEqual({
      label: undefined,
      key: '1',
      href: 'https://x',
    });
  });

  it('rejects malformed payloads rather than casting', () => {
    expect(payloadOf({ headers: 'x' }, 'table')).toBeUndefined();
    expect(payloadOf({ headers: ['x'], rows: [[1]] }, 'table')).toBeUndefined();
    expect(payloadOf({ items: [1, 2] }, 'list')).toBeUndefined();
    expect(payloadOf(null, 'image')).toBeUndefined();
    expect(payloadOf({}, 'citation')).toBeUndefined();
    expect(payloadOf({ kind: 'series' }, 'chart')).toBeUndefined();
    expect(payloadOf({ before: 'a' }, 'config-change')).toBeUndefined();
  });

  it('validates the view-system payloads a chart and a config change carry', () => {
    expect(
      payloadOf({ kind: 'series', series: [{ id: 'a', label: 'A', values: [1] }] }, 'chart')
    ).toEqual({ kind: 'series', series: [{ id: 'a', label: 'A', values: [1] }] });
    expect(payloadOf({ before: 'a=1', after: 'a=2', language: 'ini' }, 'config-change')).toEqual({
      before: 'a=1',
      after: 'a=2',
      language: 'ini',
      from: undefined,
      to: undefined,
    });
  });
});
