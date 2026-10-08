import { html } from 'lit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defineSurface,
  SurfaceComponent,
  type SurfaceState,
} from '../../src/client/core/surface.js';

const listeners = new Set<() => void>();
const binding = {
  value: 42,
  get() {
    return this.value;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(value: number) {
    this.value = value;
    for (const fn of listeners) fn();
  },
};

class ProbeSurface extends SurfaceComponent {
  status: SurfaceState = 'ready';

  protected override surfaceState(): SurfaceState {
    return this.status;
  }

  protected override surfaceApi() {
    return { ping: () => 'pong' };
  }

  protected override renderLoading() {
    return html`<span class="loading">loading</span>`;
  }

  protected override renderEmpty() {
    return html`<span class="empty">empty</span>`;
  }

  protected override renderError() {
    return html`<span class="error">error</span>`;
  }

  protected override renderBody() {
    return html`<span class="body">${binding.get()}</span>`;
  }
}

const DESCRIPTOR = { id: 'probe-surface', title: 'Probe', bindings: { tick: binding } } as const;

defineSurface(DESCRIPTOR, ProbeSurface);

describe('surface contract', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    listeners.clear();
    binding.value = 42;
  });

  it('derives the tag from the id and registers once', () => {
    expect(customElements.get('s-probe-surface')).toBe(ProbeSurface);
    defineSurface(DESCRIPTOR, ProbeSurface);
    expect(customElements.get('s-probe-surface')).toBe(ProbeSurface);
  });

  it('renders one slot per lifecycle state', async () => {
    const el = document.createElement('s-probe-surface') as ProbeSurface;
    container.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.body')).toBeTruthy();

    for (const [state, selector] of [
      ['loading', '.loading'],
      ['empty', '.empty'],
      ['error', '.error'],
    ] as const) {
      el.status = state;
      el.requestUpdate();
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector(selector)).toBeTruthy();
    }
  });

  it('watches declared bindings through the base lifecycle', async () => {
    const el = document.createElement('s-probe-surface') as ProbeSurface;
    container.appendChild(el);
    await el.updateComplete;
    binding.set(7);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.body')?.textContent).toBe('7');
  });

  it('mounts a reflective test API from the descriptor', async () => {
    const el = document.createElement('s-probe-surface') as ProbeSurface;
    container.appendChild(el);
    await el.updateComplete;
    const api = (window as unknown as { __testApi: Record<string, Record<string, any>> }).__testApi[
      'probe-surface'
    ];
    expect(api.descriptor).toEqual({ id: 'probe-surface', title: 'Probe' });
    expect(api.state()).toBe('ready');
    expect(api.snapshot()).toEqual({ tick: 42 });
    expect(api.ping()).toBe('pong');
  });
});