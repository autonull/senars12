import { afterEach, describe, expect, it } from 'vitest';
import { OverlayManager } from '../../src/client/core/overlay-manager.js';

const makeOverlay = (withButton = true): HTMLElement => {
  const el = document.createElement('div');
  if (withButton) el.appendChild(document.createElement('button'));
  document.body.appendChild(el);
  return el;
};

const managers: OverlayManager[] = [];
const makeManager = (): OverlayManager => {
  const manager = new OverlayManager(document);
  managers.push(manager);
  return manager;
};

const pressEscape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

const clickOutside = (): void => {
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
};

afterEach(() => {
  for (const manager of managers.splice(0)) manager.dispose();
  document.body.innerHTML = '';
});

describe('overlay manager', () => {
  it('tracks a stacking order and closes by id', () => {
    const manager = makeManager();
    manager.open({ id: 'toc', element: makeOverlay() });
    manager.open({ id: 'explain', element: makeOverlay() });
    expect(manager.stack()).toEqual(['toc', 'explain']);
    expect(manager.size()).toBe(2);
    expect(manager.isOpen('toc')).toBe(true);
    expect(manager.close('toc')).toBe(true);
    expect(manager.stack()).toEqual(['explain']);
    expect(manager.close('missing')).toBe(false);
  });

  it('re-opens an existing overlay to the top of the stack', () => {
    const manager = makeManager();
    const toc = makeOverlay();
    manager.open({ id: 'toc', element: toc });
    manager.open({ id: 'explain', element: makeOverlay() });
    manager.open({ id: 'toc', element: toc });
    expect(manager.stack()).toEqual(['explain', 'toc']);
  });

  it('assigns increasing z-index by stacking order', () => {
    const manager = makeManager();
    const bottom = makeOverlay();
    const top = makeOverlay();
    manager.open({ id: 'bottom', element: bottom });
    manager.open({ id: 'top', element: top });
    expect(Number(top.style.zIndex)).toBeGreaterThan(Number(bottom.style.zIndex));
  });

  it('closes the topmost overlay on Escape', () => {
    const manager = makeManager();
    manager.open({ id: 'toc', element: makeOverlay() });
    manager.open({ id: 'explain', element: makeOverlay() });
    pressEscape();
    expect(manager.stack()).toEqual(['toc']);
  });

  it('leaves a pinned overlay alone on Escape and outside-click', () => {
    const manager = makeManager();
    manager.open({ id: 'card', element: makeOverlay() });
    manager.setPinned('card', true);
    expect(manager.pinned()).toEqual(['card']);
    pressEscape();
    clickOutside();
    expect(manager.isOpen('card')).toBe(true);
  });

  it('dismisses a non-modal on outside-click but not a modal', () => {
    const manager = makeManager();
    manager.open({ id: 'popover', element: makeOverlay() });
    clickOutside();
    expect(manager.isOpen('popover')).toBe(false);

    manager.open({ id: 'dialog', element: makeOverlay(), modal: true });
    clickOutside();
    expect(manager.isOpen('dialog')).toBe(true);
  });

  it('returns focus to the anchor on close', () => {
    const manager = makeManager();
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    anchor.focus();
    manager.open({ id: 'explain', element: makeOverlay(), anchor });
    expect(document.activeElement).not.toBe(anchor);
    manager.close('explain');
    expect(document.activeElement).toBe(anchor);
  });

  it('disposes every overlay and detaches listeners', () => {
    const manager = makeManager();
    manager.open({ id: 'toc', element: makeOverlay() });
    manager.open({ id: 'explain', element: makeOverlay() });
    manager.dispose();
    expect(manager.size()).toBe(0);
    pressEscape();
    expect(manager.size()).toBe(0);
  });
});
