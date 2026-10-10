import { afterEach, describe, expect, it } from 'vitest';
import { registerPlugin, getPlugin, getPlugins, applyPlugins, resetPlugins, type PluginContribution } from '../../src/client/core/plugins.js';
import { registerSurface, getSurfaces } from '../../src/client/core/surface-registry.js';
import { registerOverlay, overlays } from '../../src/client/core/overlay-registry.js';
import { registerCommand, registeredCommands } from '../../src/client/core/commands.js';
import { eventBus } from '../../src/client/core/events.js';

afterEach(() => {
  resetPlugins();
  // Note: registries aren't easily cleared, so we rely on unique IDs
});

describe('plugin contribution point', () => {
  it('registers a plugin contribution', () => {
    const plugin: PluginContribution = {
      id: 'test-plugin',
      name: 'Test Plugin',
      surfaces: [],
      overlays: [],
      commands: [],
    };

    registerPlugin(plugin);
    const retrieved = getPlugin('test-plugin');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-plugin');
    expect(retrieved?.name).toBe('Test Plugin');
  });

  it('throws on duplicate plugin id', () => {
    const plugin: PluginContribution = {
      id: 'duplicate-plugin',
      name: 'Duplicate Plugin',
      surfaces: [],
      overlays: [],
      commands: [],
    };

    registerPlugin(plugin);
    expect(() => registerPlugin(plugin)).toThrow('already registered');
  });

  it('lists all registered plugins', () => {
    registerPlugin({ id: 'plugin-a', name: 'Plugin A', surfaces: [], overlays: [], commands: [] });
    registerPlugin({ id: 'plugin-b', name: 'Plugin B', surfaces: [], overlays: [], commands: [] });

    const plugins = getPlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(2);
    expect(plugins.some((p) => p.id === 'plugin-a')).toBe(true);
    expect(plugins.some((p) => p.id === 'plugin-b')).toBe(true);
  });

  it('applies plugin surfaces', () => {
    const testSurface = {
      id: 'test-plugin-surface',
      title: 'Test Plugin Surface',
      group: 'plugin',
      tag: 's-test-plugin',
      bindings: {},
    };

    const plugin: PluginContribution = {
      id: 'test-plugin-surface',
      name: 'Test Plugin Surface',
      surfaces: [testSurface],
      overlays: [],
      commands: [],
    };

    registerPlugin(plugin);
    applyPlugins();

    const surfaces = getSurfaces();
    expect(surfaces.some((s) => s.id === 'test-plugin-surface')).toBe(true);
  });

  it('applies plugin overlays', () => {
    const testOverlay = {
      id: 'test-plugin-overlay',
      title: 'Test Plugin Overlay',
      tag: 's-test-plugin-overlay',
      modal: false,
      autoFocus: true,
    };

    const plugin: PluginContribution = {
      id: 'test-plugin-overlay',
      name: 'Test Plugin Overlay',
      surfaces: [],
      overlays: [testOverlay],
      commands: [],
    };

    registerPlugin(plugin);
    applyPlugins();

    const overlayList = overlays();
    expect(overlayList.some((o) => o.id === 'test-plugin-overlay')).toBe(true);
  });

  it('applies plugin commands', () => {
    const testCommand = {
      id: 'demo.plugin.test',
      title: 'Demo Plugin Test',
      group: 'Demo',
      keywords: 'demo plugin test',
      run: () => {
        eventBus.emit('notification', { message: 'Test command executed' });
      },
    };

    const plugin: PluginContribution = {
      id: 'test-plugin-command',
      name: 'Test Plugin Command',
      surfaces: [],
      overlays: [],
      commands: [testCommand],
    };

    registerPlugin(plugin);
    applyPlugins();

    const commands = registeredCommands();
    expect(commands.some((c) => c.id === 'demo.plugin.test')).toBe(true);
  });
});