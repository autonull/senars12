/**
 * App composition: an app is a bundle of contributions plus the shell contract.
 * `defineApp` applies the bundle (registering its surfaces) and derives the app
 * descriptor the shell mounts by placement.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { appFor, appSurfaces, defineApp } from '../../src/client/framework/app.js';
import { defineBundle, resetBundles } from '../../src/client/framework/bundle.js';
import { surfaceFor, type Placement } from '../../src/client/framework/surface.js';

const surface = (id: string, placement: Placement) => ({
  id,
  title: `Test ${id}`,
  placement,
  tag: `s-${id}`,
});

describe('app composition', () => {
  beforeEach(() => {
    resetBundles();
  });

  const compose = () =>
    defineApp({
      bundle: defineBundle({
        id: 'test-app',
        name: 'Test App',
        description: 'A composed app',
        surfaces: {
          viewport: [surface('app-viewport', 'viewport')],
          panel: [surface('app-panel', 'panel')],
        },
      }),
      icon: 'graph',
      connection: { url: '/ws', reconnect: true },
      capability: 'language',
    });

  it('registers the app under its bundle id and carries the metadata', () => {
    const app = compose();
    expect(appFor('test-app')).toBe(app);
    expect(app.name).toBe('Test App');
    expect(app.description).toBe('A composed app');
    expect(app.icon).toBe('graph');
    expect(app.capability).toBe('language');
  });

  it('applies the bundle, registering its surfaces globally', () => {
    compose();
    expect(surfaceFor('app-viewport')?.placement).toBe('viewport');
    expect(surfaceFor('app-panel')?.placement).toBe('panel');
  });

  it('groups the app surfaces by placement for the shell', () => {
    const grouped = appSurfaces(compose());
    expect(grouped.get('viewport')?.map((s) => s.id)).toEqual(['app-viewport']);
    expect(grouped.get('panel')?.map((s) => s.id)).toEqual(['app-panel']);
    expect(grouped.has('overlay')).toBe(false);
  });
});
