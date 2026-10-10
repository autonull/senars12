/**
 * Plugin Contribution Point (§X.4).
 * In-repo seam for modules to contribute surfaces, commands, lenses, overlays,
 * view adapters, layouts, and renderers without shell edits.
 * Not a third-party loader — a single `plugins.ts` that gathers contributions.
 */

import { registerSurface } from './surface-registry.js';
import { registerOverlay } from './overlay-registry.js';
import { registerViewAdapter } from './view-adapter.js';
import { registerRenderer } from './workspace-renderer.js';
import { registerCommand } from './commands.js';
import { registerLens } from './store.js';
import { registerLayoutId } from './layout-ids.js';

import type { SurfaceDescriptor } from './surface-registry.js';
import type { OverlayDescriptor } from './overlay-registry.js';
import type { ViewAdapter } from './view-adapter.js';
import type { WorkspaceRenderer } from './workspace-renderer.js';
import type { Command } from './commands.js';
import type { LensSpec } from '../../shared/lens-schema.js';
import type { LayoutId } from './layout-ids.js';

export interface PluginContribution {
  /** Unique plugin identifier. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Surfaces to register. */
  readonly surfaces?: readonly SurfaceDescriptor[];
  /** Overlays to register. */
  readonly overlays?: readonly OverlayDescriptor[];
  /** View adapters to register. */
  readonly viewAdapters?: readonly ViewAdapter[];
  /** Workspace renderers to register. */
  readonly renderers?: readonly WorkspaceRenderer[];
  /** Commands to register. */
  readonly commands?: readonly Command[];
  /** Lens specs to register. */
  readonly lenses?: readonly LensSpec[];
  /** Layout IDs to register. */
  readonly layouts?: readonly LayoutId[];
}

/** All registered plugin contributions. */
const contributions = new Map<string, PluginContribution>();

/** Register a plugin's contributions. */
export function registerPlugin(contribution: PluginContribution): void {
  if (contributions.has(contribution.id)) {
    throw new Error(`Plugin with id "${contribution.id}" already registered`);
  }
  contributions.set(contribution.id, contribution);
}

/** Get a plugin contribution by id. */
export function getPlugin(id: string): PluginContribution | undefined {
  return contributions.get(id);
}

/** All registered plugin contributions. */
export function getPlugins(): readonly PluginContribution[] {
  return [...contributions.values()];
}

/** Apply all registered plugin contributions to their respective registries. */
export function applyPlugins(): void {
  for (const plugin of contributions.values()) {
    // Surfaces
    if (plugin.surfaces) {
      for (const surface of plugin.surfaces) {
        registerSurface(surface);
      }
    }

    // Overlays
    if (plugin.overlays) {
      for (const overlay of plugin.overlays) {
        registerOverlay(overlay);
      }
    }

    // View adapters
    if (plugin.viewAdapters) {
      for (const adapter of plugin.viewAdapters) {
        registerViewAdapter(adapter);
      }
    }

    // Renderers
    if (plugin.renderers) {
      for (const renderer of plugin.renderers) {
        registerRenderer(renderer);
      }
    }

    // Commands
    if (plugin.commands) {
      for (const command of plugin.commands) {
        registerCommand(command);
      }
    }

    // Lenses
    if (plugin.lenses) {
      for (const lens of plugin.lenses) {
        registerLens(lens);
      }
    }

    // Layouts
    if (plugin.layouts) {
      for (const layout of plugin.layouts) {
        registerLayoutId(layout);
      }
    }
  }
}

/** Reset all plugin registrations (for testing). */
export function resetPlugins(): void {
  contributions.clear();
}