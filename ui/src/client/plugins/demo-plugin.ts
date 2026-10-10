/**
 * Demo Plugin — demonstrates the plugin contribution point (§X.4).
 * Contributes a surface, overlay, command, and lens.
 */

import { registerPlugin, type PluginContribution } from '../core/plugins.js';
import type { SurfaceDescriptor } from '../core/surface-registry.js';
import type { OverlayDescriptor } from '../core/overlay-registry.js';
import type { Command } from '../core/commands.js';
import type { LensSpec, ModulationSpec } from '../../shared/lens-schema.js';
import { eventBus } from '../core/events.js';

// Demo surface
const demoSurface: SurfaceDescriptor = {
  id: 'demo-plugin-surface',
  title: 'Demo Plugin Surface',
  group: 'plugin',
  tag: 's-demo-plugin',
  bindings: {},
};

// Demo overlay
const demoOverlay: OverlayDescriptor = {
  id: 'demo-plugin-overlay',
  title: 'Demo Plugin Overlay',
  tag: 's-demo-plugin-overlay',
  modal: false,
  autoFocus: true,
  window: { draggable: true, resizable: true, minimize: true, persist: true },
};

// Demo command
const demoCommand: Command = {
  id: 'demo.plugin.hello',
  title: 'Demo Plugin: Say Hello',
  group: 'Demo',
  keywords: 'demo plugin hello',
  run: () => {
    console.log('[Demo Plugin] Hello from the plugin!');
    eventBus.emit('app-error', {
      message: 'Demo Plugin: Hello!',
      detail: 'This is a demo notification from the plugin system',
    });
  },
};

// Demo lens with proper ModulationSpec
const demoModulation: ModulationSpec = {
  op: 'union',
  children: [
    { op: 'channel', channel: 'color', child: { op: 'const', value: '#ff6b6b' } },
    { op: 'channel', channel: 'size', child: { op: 'const', value: 20 } },
    { op: 'channel', channel: 'opacity', child: { op: 'const', value: 0.8 } },
  ],
};

const demoLens: LensSpec = {
  id: 'demo-lens',
  label: 'Demo Lens',
  description: 'A demo lens from the plugin system',
  modulation: demoModulation,
};

const demoPlugin: PluginContribution = {
  id: 'demo-plugin',
  name: 'Demo Plugin',
  surfaces: [demoSurface],
  overlays: [demoOverlay],
  commands: [demoCommand],
  lenses: [demoLens],
};

// Register the plugin
registerPlugin(demoPlugin);

// Export for manual application if needed
export { demoPlugin };