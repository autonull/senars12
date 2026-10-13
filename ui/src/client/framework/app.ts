/**
 * App model — the one composition primitive for a SeNARS app.
 *
 * An app is a named bundle of:
 * - surfaces (by placement: viewport, panel, overlay, inline)
 * - a connection config (optional, for multi-backend apps)
 * - app-level lifecycle hooks (onMount, onUnmount)
 * - optional default lens/graphLayer/filter
 *
 * The app shell (`<s-app-shell>`) mounts the surfaces by placement,
 * provides the connection/overlay/palette chrome, and exposes a test API.
 */

import { createIdRegistry, type Registry } from '../core/registry.js';
import type { SurfaceDescriptor, Placement } from './surface.js';
import type { Capability } from '../core/capabilities.js';

/** App-level lifecycle hooks. */
export interface AppLifecycle {
  /** Called after the shell mounts and surfaces are registered. */
  onMount?: (ctx: AppContext) => void | Promise<void>;
  /** Called before the shell unmounts. */
  onUnmount?: (ctx: AppContext) => void | Promise<void>;
}

/** Runtime context passed to app lifecycle hooks. */
export interface AppContext {
  /** The app's unique id. */
  readonly appId: string;
  /** Registered surfaces for this app. */
  readonly surfaces: ReadonlyMap<Placement, SurfaceDescriptor[]>;
  /** Connect to the backend. */
  readonly connect: (config?: ConnectionConfig) => Promise<void>;
  /** Disconnect from the backend. */
  readonly disconnect: () => Promise<void>;
  /** Send a message to the backend. */
  readonly send: (message: unknown) => void;
  /** Get a surface by id. */
  readonly getSurface: (id: string) => SurfaceDescriptor | undefined;
}

/** Connection configuration for the app. */
export interface ConnectionConfig {
  /** WebSocket URL (defaults to /ws). */
  readonly url?: string;
  /** Reconnect on disconnect. */
  readonly reconnect?: boolean;
}

/** App descriptor — the data that defines an app. */
export interface AppDescriptor<K extends string = string> {
  /** Stable app id — used in URL path `/apps/<id>/`. */
  readonly id: K;
  /** Human-readable app name. */
  readonly name: string;
  /** Short description for the app switcher. */
  readonly description?: string;
  /** Icon for the app switcher (matches `s-icon` names). */
  readonly icon?: string;
  /** Surfaces this app mounts, keyed by placement. */
  readonly surfaces: Readonly<Partial<Record<Placement, SurfaceDescriptor[]>>>;
  /** Default lens for this app (if viewport surfaces present). */
  readonly defaultLens?: string;
  /** Default graph layer for this app (if viewport surfaces present). */
  readonly defaultGraphLayer?: string;
  /** Default capability filter for this app. */
  readonly defaultCapabilityFilter?: string;
  /** Connection configuration. */
  readonly connection?: ConnectionConfig;
  /** App lifecycle hooks. */
  readonly lifecycle?: AppLifecycle;
  /** Capability required to access this app. */
  readonly capability?: Capability;
}

/** The app registry — one registry for all apps. */
const appRegistry: Registry<string, AppDescriptor> = createIdRegistry();

/** Register an app descriptor. */
export const registerApp = (descriptor: AppDescriptor): void => {
  appRegistry.register(descriptor);
};

/** Get an app descriptor by id. */
export const appFor = (id: string): AppDescriptor | undefined => appRegistry.get(id);

/** All registered apps, in registration order. */
export const getApps = (): readonly AppDescriptor[] => appRegistry.all();

/** Get app ids. */
export const appIds = (): readonly string[] => appRegistry.ids;

/** The app shell element — mounts surfaces by placement. */
export const APP_SHELL_TAG = 's-app-shell';

/** Define an app and register it. Returns the descriptor for composition. */
export function defineApp<K extends string>(descriptor: AppDescriptor<K>): AppDescriptor<K> {
  registerApp(descriptor);
  return descriptor;
}

/** Get all surfaces for an app, grouped by placement. */
export function appSurfaces(app: AppDescriptor): Map<Placement, SurfaceDescriptor[]> {
  const map = new Map<Placement, SurfaceDescriptor[]>();
  for (const placement of ['viewport', 'panel', 'overlay', 'inline'] as const) {
    const surfaces = app.surfaces[placement];
    if (surfaces && surfaces.length > 0) {
      map.set(placement, surfaces);
    }
  }
  return map;
}

/** Create a connection config for an app (merges app defaults with runtime overrides). */
export function resolveConnectionConfig(
  app: AppDescriptor,
  overrides: ConnectionConfig = {}
): ConnectionConfig {
  return {
    url: overrides.url ?? app.connection?.url,
    reconnect: overrides.reconnect ?? app.connection?.reconnect ?? true,
  };
}