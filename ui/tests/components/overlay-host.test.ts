import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayHost } from '../../src/client/core/overlay-host.js';
import {
  overlayDescriptor,
  overlays,
  registerOverlay,
} from '../../src/client/core/overlay-registry.js';

registerOverlay({ id: 'test-overlay', title: 'Test overlay', tag: 'div' });

const hosts: OverlayHost[] = [];
const makeHost = () => {
  const host = new OverlayHost(document.body, document);
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose();
  document.body.innerHTML = '';
});

describe('overlay registry', () => {
  it('exposes registered descriptors', () => {
    expect(overlayDescriptor('test-overlay')).toMatchObject({ id: 'test-overlay', tag: 'div' });
    expect(overlays().map((overlay) => overlay.id)).toContain('test-overlay');
  });
});

describe('overlay host', () => {
  it('lazily creates the overlay element in the container and opens it', () => {
    const host = makeHost();
    expect(host.element('test-overlay')).toBeUndefined();
    expect(host.open('test-overlay')).toBe(true);
    const element = host.element('test-overlay');
    expect(element && document.body.contains(element)).toBe(true);
    expect(element?.hidden).toBe(false);
    expect(host.isOpen('test-overlay')).toBe(true);
    expect(host.stack()).toEqual(['test-overlay']);
  });

  it('reuses one element across close and re-open', () => {
    const host = makeHost();
    host.open('test-overlay');
    const first = host.element('test-overlay');
    expect(host.close()).toBe(true);
    expect(host.isOpen('test-overlay')).toBe(false);
    host.open('test-overlay');
    expect(host.element('test-overlay')).toBe(first);
  });

  it('assigns the inspected ref before opening', () => {
    const host = makeHost();
    host.open('test-overlay', { ref: 'blk-1' });
    expect((host.element('test-overlay') as { ref?: string } | undefined)?.ref).toBe('blk-1');
  });

  it('ignores unknown overlay ids', () => {
    const host = makeHost();
    expect(host.open('missing')).toBe(false);
    expect(host.stack()).toEqual([]);
  });

  it('announces each open on the element', () => {
    const host = makeHost();
    host.open('test-overlay');
    const element = host.element('test-overlay')!;
    const opened = vi.fn();
    element.addEventListener('overlay-open', opened);
    host.close();
    host.open('test-overlay', { ref: 'x' });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { id: 'test-overlay', ref: 'x' } })
    );
  });

  it('defaults the anchor to the element focused when opening', () => {
    const host = makeHost();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    host.open('test-overlay');
    host.close();
    expect(document.activeElement).toBe(button);
  });

  it('disposes the manager and removes overlay elements', () => {
    const host = makeHost();
    host.open('test-overlay');
    const element = host.element('test-overlay');
    host.dispose();
    expect(element && document.body.contains(element)).toBe(false);
    expect(host.stack()).toEqual([]);
  });
});
