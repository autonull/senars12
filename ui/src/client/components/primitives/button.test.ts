import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.customElements = dom.window.customElements;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id: number) => clearTimeout(id);

// Import component after DOM setup
await import('../src/client/components/primitives/button.js');

describe('s-button', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders with primary variant by default', () => {
    container.innerHTML = '<s-button>Click me</s-button>';
    const button = container.querySelector('s-button');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('variant')).toBe('primary');
  });

  it('renders with specified variant', () => {
    container.innerHTML = '<s-button variant="secondary">Secondary</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.getAttribute('variant')).toBe('secondary');
  });

  it('renders with specified size', () => {
    container.innerHTML = '<s-button size="lg">Large</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.getAttribute('size')).toBe('lg');
  });

  it('shows disabled state', () => {
    container.innerHTML = '<s-button disabled>Disabled</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  it('shows loading state', () => {
    container.innerHTML = '<s-button loading>Loading</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.hasAttribute('loading')).toBe(true);
  });

  it('dispatches click event', () => {
    const clickHandler = vi.fn();
    container.innerHTML = '<s-button>Click me</s-button>';
    const button = container.querySelector('s-button');
    button?.addEventListener('click', clickHandler);
    button?.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });
});