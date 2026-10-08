import { describe, expect, it } from 'vitest';
import { FocusTrap } from '../../src/client/core/focus-trap.js';

const shadowHost = (markup: string): HTMLElement => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = markup;
  document.body.appendChild(host);
  return host;
};

describe('FocusTrap', () => {
  it('focuses the first focusable inside a shadow root', () => {
    const host = shadowHost('<button id="a">a</button><button id="b">b</button>');
    const trap = new FocusTrap(host);
    trap.activate();
    expect(document.activeElement).toBe(host);
    trap.dispose();
  });

  it('restores focus to the previously focused element', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const host = shadowHost('<button id="a">a</button>');
    const trap = new FocusTrap(host);
    trap.activate();
    trap.dispose();
    expect(document.activeElement).toBe(trigger);
  });
});
