import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/timeline-scrubber.js';
import { $view } from '../../src/client/core/store.js';

const mount = async () => {
  const el = document.createElement('timeline-scrubber');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const setT = (t: number) => $view.set({ ...$view.get(), timeline: { t } });

afterEach(() => {
  document.body.innerHTML = '';
  setT(Number.POSITIVE_INFINITY);
});

describe('timeline scrubber controls (§4.4)', () => {
  it('reads as live and disables Now at the present', async () => {
    setT(Number.POSITIVE_INFINITY);
    const el = await mount();
    const now = el.shadowRoot?.querySelector<HTMLButtonElement>('button[data-action="now"]');
    expect(now?.disabled).toBe(true);
    expect(el.shadowRoot?.querySelector('[role="status"]')?.textContent).toContain('Live');
  });

  it('returns to the present with Now after scrubbing into the past', async () => {
    setT(500);
    const el = await mount();
    expect(el.shadowRoot?.querySelector('[role="status"]')?.textContent).not.toContain('Live');
    el.shadowRoot?.querySelector<HTMLButtonElement>('button[data-action="now"]')?.click();
    expect($view.get().timeline.t).toBe(Number.POSITIVE_INFINITY);
  });
});
