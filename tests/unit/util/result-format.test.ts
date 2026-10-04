import {
  attempt,
  attemptAsync,
  err,
  flatMap,
  formatBytes,
  formatDuration,
  getOrElse,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  unwrapOrThrow,
} from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('Result', () => {
  it('narrows on `ok` without a cast', () => {
    const good: ReturnType<typeof ok<number>> = ok(2);
    expect(isOk(good)).toBe(true);
    expect(isErr(good)).toBe(false);
    if (good.ok) expect(good.value + 1).toBe(3);

    const bad = err(new Error('nope'));
    expect(isErr(bad)).toBe(true);
    if (bad.ok === false) expect(bad.error.message).toBe('nope');
  });

  it('map transforms the success arm and passes the error arm through', () => {
    expect(map(ok(2), (n) => n * 5)).toEqual({ ok: true, value: 10 });
    const failure = err(new Error('e'));
    expect(map(failure, (n: number) => n * 5)).toBe(failure);
  });

  it('mapErr transforms the error arm and passes the success arm through', () => {
    const good = ok(2);
    expect(mapErr(good, (e: Error) => e.message)).toBe(good);
    expect(mapErr(err(new Error('boom')), (e) => e.message)).toEqual({
      ok: false,
      error: 'boom',
    });
  });

  it('flatMap composes without unwrapping', () => {
    expect(flatMap(ok(2), (n) => (n > 0 ? ok(n + 1) : err(new Error('non-positive'))))).toEqual({
      ok: true,
      value: 3,
    });
    expect(flatMap(ok(-1), (n) => (n > 0 ? ok(n) : err(new Error('non-positive'))))).toEqual({
      ok: false,
      error: new Error('non-positive'),
    });
  });

  it('getOrElse and match fold both arms', () => {
    expect(getOrElse(ok(1), () => 99)).toBe(1);
    expect(getOrElse(err(new Error('x')), () => 99)).toBe(99);
    expect(match(ok(1), { onOk: (n) => `ok:${n}`, onErr: (e: Error) => `err:${e.message}` })).toBe(
      'ok:1'
    );
    expect(
      match(err(new Error('x')), {
        onOk: (n) => `ok:${n}`,
        onErr: (e: Error) => `err:${e.message}`,
      })
    ).toBe('err:x');
  });

  it('unwrapOrThrow returns the value or rethrows the exact error', () => {
    expect(unwrapOrThrow(ok('v'))).toBe('v');
    const original = new Error('inner');
    expect(() => unwrapOrThrow(err(original))).toThrow(original);
  });

  it('attempt captures a thrown value as an Error', () => {
    expect(attempt(() => 7)).toEqual({ ok: true, value: 7 });
    const thrown = attempt(() => {
      throw new Error('sync');
    });
    expect(thrown.ok).toBe(false);
    if (thrown.ok === false) expect(thrown.error).toBeInstanceOf(Error);
    expect(unwrapOrThrow(attempt(() => 1))).toBe(1);
  });

  it('attemptAsync captures a rejection as an Error', async () => {
    await expect(attemptAsync(async () => 'v')).resolves.toEqual({ ok: true, value: 'v' });
    const rejected = await attemptAsync(async () => {
      throw 'a bare string';
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok === false) expect(rejected.error.message).toBe('a bare string');
  });
});

describe('formatDuration', () => {
  it('keeps sub-millisecond precision instead of rounding a fast call to zero', () => {
    expect(formatDuration(0.4)).toBe('0.400ms');
    expect(formatDuration(0)).toBe('0.000ms');
  });

  it('reads as milliseconds under a second and as seconds above it', () => {
    expect(formatDuration(12.34)).toBe('12.3ms');
    expect(formatDuration(999.9)).toBe('999.9ms');
    expect(formatDuration(1500)).toBe('1.50s');
  });

  it('renders a non-finite span as a dash rather than "Infinityms"', () => {
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('-');
    expect(formatDuration(Number.NaN)).toBe('-');
  });
});

describe('formatBytes', () => {
  it('leaves integral byte counts decimal-free', () => {
    expect(formatBytes(0)).toBe('0B');
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(1023)).toBe('1023B');
  });

  it('scales through the unit boundaries', () => {
    expect(formatBytes(1024)).toBe('1.0KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(1234567)).toBe('1.2MB');
    expect(formatBytes(1024 ** 4)).toBe('1.0TB');
  });

  it('rejects a nonsensical size rather than rendering it', () => {
    expect(formatBytes(-1)).toBe('-');
    expect(formatBytes(Number.NaN)).toBe('-');
  });
});
