/**
 * Contribution Validator — boot-time validation for all registries (§X.1).
 * Ensures unique IDs, resolvable tags, declared bindings across all registries.
 * A bad contribution fails loud at registration time.
 */

import { Capability, CAPABILITY_IDS } from './capabilities.js';
import { getSurfaces, surfaceTag, type SurfaceDescriptor } from './surface-registry.js';
import { overlays, type OverlayDescriptor } from './overlay-registry.js';
import { viewAdapters, type ViewAdapter } from './view-adapter.js';
import { workspaceRenderers, type WorkspaceRenderer, type WorkspaceRendererCaps } from './workspace-renderer.js';
import { registeredCommands, type Command } from './commands.js';
import { isRegisteredLayoutId } from './layout-ids.js';

export interface ValidationError {
  registry: string;
  id: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const seenIds = new Map<string, { registry: string; id: string }>();

function checkUniqueId(registry: string, id: string): ValidationError | null {
  const existing = seenIds.get(id);
  if (existing) {
    return {
      registry,
      id,
      message: `Duplicate ID "${id}" already registered in ${existing.registry}`,
    };
  }
  seenIds.set(id, { registry, id });
  return null;
}

function validateSurface(descriptor: SurfaceDescriptor): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('surface', descriptor.id);
  if (uniqueError) errors.push(uniqueError);

  if (!descriptor.title || descriptor.title.trim() === '') {
    errors.push({ registry: 'surface', id: descriptor.id, message: 'Title is required' });
  }

  const tag = surfaceTag(descriptor);
  if (!tag || tag.trim() === '') {
    errors.push({ registry: 'surface', id: descriptor.id, message: 'Tag is required' });
  }

  if (descriptor.bindings) {
    for (const [key, binding] of Object.entries(descriptor.bindings)) {
      if (!binding || typeof binding.get !== 'function') {
        errors.push({
          registry: 'surface',
          id: descriptor.id,
          message: `Binding "${key}" must have a get() function`,
        });
      }
    }
  }

  return errors;
}

function validateOverlay(descriptor: OverlayDescriptor): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('overlay', descriptor.id);
  if (uniqueError) errors.push(uniqueError);

  if (!descriptor.title || descriptor.title.trim() === '') {
    errors.push({ registry: 'overlay', id: descriptor.id, message: 'Title is required' });
  }

  if (!descriptor.tag || descriptor.tag.trim() === '') {
    errors.push({ registry: 'overlay', id: descriptor.id, message: 'Tag is required' });
  }

  if (descriptor.capability && !CAPABILITY_IDS.includes(descriptor.capability)) {
    errors.push({
      registry: 'overlay',
      id: descriptor.id,
      message: `Invalid capability "${descriptor.capability}"`,
    });
  }

  return errors;
}

function validateViewAdapter(adapter: ViewAdapter): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('view-adapter', adapter.shape);
  if (uniqueError) errors.push(uniqueError);

  if (!adapter.tag || adapter.tag.trim() === '') {
    errors.push({ registry: 'view-adapter', id: adapter.shape, message: 'Tag is required' });
  }

  if (!adapter.budgets || adapter.budgets.length === 0) {
    errors.push({ registry: 'view-adapter', id: adapter.shape, message: 'At least one budget is required' });
  }

  if (!adapter.interactions || adapter.interactions.length === 0) {
    errors.push({ registry: 'view-adapter', id: adapter.shape, message: 'At least one interaction is required' });
  }

  return errors;
}

function validateRenderer(renderer: WorkspaceRenderer): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('renderer', renderer.id);
  if (uniqueError) errors.push(uniqueError);

  if (!renderer.label || renderer.label.trim() === '') {
    errors.push({ registry: 'renderer', id: renderer.id, message: 'Label is required' });
  }

  const caps = renderer.capabilities();
  if (!caps.interactions || caps.interactions.length === 0) {
    errors.push({ registry: 'renderer', id: renderer.id, message: 'At least one interaction is required' });
  }

  if (!caps.blockKinds || (Array.isArray(caps.blockKinds) && caps.blockKinds.length === 0)) {
    errors.push({ registry: 'renderer', id: renderer.id, message: 'Block kinds are required' });
  }

  if (caps.requiredCapability && !CAPABILITY_IDS.includes(caps.requiredCapability)) {
    errors.push({
      registry: 'renderer',
      id: renderer.id,
      message: `Invalid required capability "${caps.requiredCapability}"`,
    });
  }

  return errors;
}

function validateCommand(command: Command): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('command', command.id);
  if (uniqueError) errors.push(uniqueError);

  if (!command.title || command.title.trim() === '') {
    errors.push({ registry: 'command', id: command.id, message: 'Title is required' });
  }

  if (!command.run || typeof command.run !== 'function') {
    errors.push({ registry: 'command', id: command.id, message: 'Run function is required' });
  }

  return errors;
}

function validateLayoutId(id: string): ValidationError[] {
  const errors: ValidationError[] = [];

  const uniqueError = checkUniqueId('layout', id);
  if (uniqueError) errors.push(uniqueError);

  if (!isRegisteredLayoutId(id)) {
    errors.push({ registry: 'layout', id, message: `Layout "${id}" is not registered in layout-ids` });
  }

  return errors;
}

/**
 * Validates all registered contributions across all registries.
 * Call this at boot time to fail fast on invalid contributions.
 */
export function validateAllContributions(): ValidationResult {
  seenIds.clear();
  const errors: ValidationError[] = [];

  // Validate surfaces
  for (const surface of getSurfaces()) {
    errors.push(...validateSurface(surface));
  }

  // Validate overlays
  for (const overlay of overlays()) {
    errors.push(...validateOverlay(overlay));
  }

  // Validate view adapters
  for (const adapter of viewAdapters()) {
    errors.push(...validateViewAdapter(adapter));
  }

  // Validate renderers
  for (const renderer of workspaceRenderers()) {
    errors.push(...validateRenderer(renderer));
  }

  // Validate commands
  for (const command of registeredCommands()) {
    errors.push(...validateCommand(command));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a single contribution before registration.
 * Throws on validation failure.
 */
export function validateContribution<T>(
  registry: string,
  id: string,
  descriptor: T,
  validator: (d: T) => ValidationError[]
): void {
  const errors = validator(descriptor);
  if (errors.length > 0) {
    const messages = errors.map((e) => `${e.registry}:${e.id} - ${e.message}`).join('\n');
    throw new Error(`Contribution validation failed for ${registry}:${id}\n${messages}`);
  }
}