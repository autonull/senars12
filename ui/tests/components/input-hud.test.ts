import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/input-hud.js';

const mount = async () => {
  const el = document.createElement('input-hud');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const type = async (el: HTMLElement, value: string) => {
  const textarea = el.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea');
  if (!textarea) throw new Error('missing textarea');
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
  await el.updateComplete;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('--composer-height');
});

describe('input hud decomposition preview', () => {
  it('shows one chip per extracted segment', async () => {
    const el = await mount();
    await type(el, 'A. What is B?');
    const segments = el.shadowRoot?.querySelectorAll('.segment') ?? [];
    expect(segments).toHaveLength(2);
    expect(segments[0]?.getAttribute('data-kind')).toBe('claim');
    expect(segments[1]?.getAttribute('data-kind')).toBe('question');
  });

  it('hides the preview for a single plain claim', async () => {
    const el = await mount();
    await type(el, 'hello');
    expect(el.shadowRoot?.querySelectorAll('.segment')).toHaveLength(0);
  });

  it('shows a command chip for a slash line', async () => {
    const el = await mount();
    await type(el, '/config reasoning true');
    expect(el.shadowRoot?.querySelector('.segment')?.getAttribute('data-kind')).toBe('command');
  });
});

describe('composer modes', () => {
  it('offers only the language modes under the default composition', async () => {
    const el = await mount();
    const ids = [...(el.shadowRoot?.querySelectorAll('.modes button') ?? [])].map((b) =>
      b.getAttribute('data-mode')
    );
    expect(ids).toContain('ask');
    expect(ids).not.toContain('believe');
    expect(ids).not.toContain('tool');
  });

  it('reshapes the decomposition to the declared mode', async () => {
    const el = await mount();
    el.shadowRoot?.querySelector<HTMLButtonElement>('[data-mode="question"]')?.click();
    await el.updateComplete;
    await type(el, 'Robins are birds.');
    expect(el.shadowRoot?.querySelector('.segment')?.getAttribute('data-kind')).toBe('question');
  });
});

describe('composer height publication', () => {
  it('publishes the composer height for floating chrome above it', async () => {
    const original = globalThis.ResizeObserver;
    class StubObserver {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
      unobserve() {}
    }
    globalThis.ResizeObserver = StubObserver as unknown as typeof ResizeObserver;
    try {
      await mount();
      await Promise.resolve();
      expect(document.documentElement.style.getPropertyValue('--composer-height')).toMatch(/px$/);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
