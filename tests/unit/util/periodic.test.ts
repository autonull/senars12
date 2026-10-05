import { periodic } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('periodic', () => {
  it('repeats the task on the interval', async () => {
    let ticks = 0;
    const stop = periodic(() => ticks++, 5);
    await new Promise((resolve) => setTimeout(resolve, 60));
    stop();
    expect(ticks).toBeGreaterThan(1);
  });

  it('does not run the task once the disposer is called', async () => {
    let ticks = 0;
    const stop = periodic(() => ticks++, 5);
    await new Promise((resolve) => setTimeout(resolve, 30));
    stop();
    const atStop = ticks;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ticks).toBe(atStop);
  });

  it('is safe to dispose twice', async () => {
    const stop = periodic(() => {}, 5);
    stop();
    expect(() => stop()).not.toThrow();
  });

  it('leaves no handle that would keep the process alive', () => {
    // Two of the eleven hand-rolled sites this replaced omitted unref(), and one
    // of those held the event loop open from a self-analysis timer.
    const handles = process.getActiveResourcesInfo().filter((r) => r === 'Timeout');
    const stop = periodic(() => {}, 60_000);
    const during = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    stop();
    expect(during).toBe(handles.length);
  });
});
