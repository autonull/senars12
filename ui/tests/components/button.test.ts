import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('s-button', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders with secondary variant by default', async () => {
    await import('../../src/client/components/primitives/button.js');
    container.innerHTML = '<s-button>Click me</s-button>';
    const button = container.querySelector('s-button');
    expect(button).toBeTruthy();
    expect(button?.variant).toBe('secondary');
  });

  it('renders with specified variant', async () => {
    await import('../../src/client/components/primitives/button.js');
    container.innerHTML = '<s-button variant="secondary">Secondary</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.variant).toBe('secondary');
  });

  it('renders with specified size', async () => {
    await import('../../src/client/components/primitives/button.js');
    container.innerHTML = '<s-button size="lg">Large</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.size).toBe('lg');
  });

  it('shows disabled state', async () => {
    await import('../../src/client/components/primitives/button.js');
    container.innerHTML = '<s-button disabled>Disabled</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.disabled).toBe(true);
  });

  it('shows loading state', async () => {
    await import('../../src/client/components/primitives/button.js');
    container.innerHTML = '<s-button loading>Loading</s-button>';
    const button = container.querySelector('s-button');
    expect(button?.hasAttribute('loading')).toBe(true);
  });

  it('dispatches click event', async () => {
    await import('../../src/client/components/primitives/button.js');
    const clickHandler = vi.fn();
    container.innerHTML = '<s-button>Click me</s-button>';
    const button = container.querySelector('s-button');
    button?.addEventListener('click', clickHandler);
    button?.click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });
});
