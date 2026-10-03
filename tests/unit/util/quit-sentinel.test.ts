import { errMsg } from '@senars/util';
import { isQuitResult, QUIT_SENTINEL } from '@senars/util/commands';
import { describe, expect, it } from 'vitest';

describe('QUIT_SENTINEL', () => {
  it('is the one value both ends of the command channel agree on', () => {
    // A command definition lives in `nar` and the connection that reads its result
    // lives in `io`, and `nar` may not import `io` — so both sides name the
    // sentinel, and a second spelling would silently read as ordinary output.
    expect(QUIT_SENTINEL).toBe('__CLI_QUIT__');
  });

  it('recognises the sentinel and nothing else', () => {
    expect(isQuitResult(QUIT_SENTINEL)).toBe(true);
    expect(isQuitResult('')).toBe(false);
    expect(isQuitResult('quit')).toBe(false);
    expect(isQuitResult(`${QUIT_SENTINEL} `)).toBe(false);
  });
});

describe('errMsg', () => {
  it('reads the message off an Error', () => {
    expect(errMsg(new Error('boom'))).toBe('boom');
    expect(errMsg(new TypeError('bad type'))).toBe('bad type');
  });

  it('coerces a non-Error rather than reading as undefined', () => {
    expect(errMsg('plain string')).toBe('plain string');
    expect(errMsg(404)).toBe('404');
  });

  it('uses the fallback where a non-Error carries no readable message', () => {
    // The throw site needs this: `String(undefined)` next to real stack frames
    // reads as a bug report about the wrong thing entirely.
    expect(errMsg(undefined, 'sandboxed head load failed')).toBe('sandboxed head load failed');
    expect(errMsg(null, 'no cause')).toBe('no cause');
  });

  it('ignores the fallback for a real Error, whose message is the better one', () => {
    expect(errMsg(new Error('real cause'), 'generic')).toBe('real cause');
  });
});
