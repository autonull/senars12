import { getSurfaces, surfaceTag, type SurfaceDescriptor } from './surface-registry.js';

/**
 * Reflective generators: turn a surface descriptor into the parameters each
 * consumer needs — a Storybook story, a gallery cell, an a11y target and a docs
 * stub. Because the descriptor is data, one `defineSurface` feeds all of them;
 * the file emission into Storybook/gallery/docs is the wiring on top (2.5/2.7/11.3).
 */

export interface SurfaceStory {
  title: string;
  name: string;
  tags: string[];
  parameters: { a11y: { config: { rules: Record<string, unknown> } } };
}

export interface SurfaceGalleryCell {
  id: string;
  group: string;
  title: string;
  tag: string;
}

export interface SurfaceA11yTarget {
  surface: string;
  tag: string;
  role: string;
  label: string;
  keyboard: boolean;
  keyboardReason?: string;
}

export interface SurfaceDoc {
  id: string;
  title: string;
  tag: string;
  group: string;
  bindings: string[];
}

export interface SurfaceArtifacts {
  stories: SurfaceStory[];
  cells: SurfaceGalleryCell[];
  a11y: SurfaceA11yTarget[];
  docs: SurfaceDoc[];
}

const groupOf = (descriptor: SurfaceDescriptor): string => descriptor.group ?? 'Surfaces';

export const surfaceStory = (descriptor: SurfaceDescriptor): SurfaceStory => ({
  title: `${groupOf(descriptor)}/${descriptor.title}`,
  name: 'Default',
  tags: ['autodocs'],
  parameters: { a11y: { config: { rules: {} } } },
});

export const surfaceGalleryCell = (descriptor: SurfaceDescriptor): SurfaceGalleryCell => ({
  id: descriptor.id,
  group: groupOf(descriptor),
  title: descriptor.title,
  tag: surfaceTag(descriptor),
});

export const surfaceA11y = (descriptor: SurfaceDescriptor): SurfaceA11yTarget => ({
  surface: descriptor.id,
  tag: surfaceTag(descriptor),
  role: descriptor.a11y?.role ?? 'region',
  label: descriptor.a11y?.label ?? descriptor.title,
  keyboard: descriptor.a11y?.keyboard ?? true,
  ...(descriptor.a11y?.keyboardReason ? { keyboardReason: descriptor.a11y.keyboardReason } : {}),
});

/**
 * The a11y gate: every surface must expose a role and an accessible name, and
 * either a keyboard path or a stated reason it has none. A surface that omits a
 * label, forgets a role, or silently drops keyboard access fails here.
 */
export const validateSurfaceA11y = (targets: readonly SurfaceA11yTarget[]): void => {
  for (const target of targets) {
    if (!target.label.trim()) throw new Error(`surface "${target.surface}" has no accessible label`);
    if (!target.role.trim()) throw new Error(`surface "${target.surface}" has no ARIA role`);
    if (!target.keyboard && !target.keyboardReason?.trim()) {
      throw new Error(`surface "${target.surface}" has no keyboard path and no reason`);
    }
  }
};

export const surfaceDoc = (descriptor: SurfaceDescriptor): SurfaceDoc => ({
  id: descriptor.id,
  title: descriptor.title,
  tag: surfaceTag(descriptor),
  group: groupOf(descriptor),
  bindings: Object.keys(descriptor.bindings ?? {}),
});

/** Every reflective artifact for the registered surfaces (or the ones given). */
export function generateSurfaces(
  descriptors: readonly SurfaceDescriptor[] = getSurfaces()
): SurfaceArtifacts {
  return {
    stories: descriptors.map(surfaceStory),
    cells: descriptors.map(surfaceGalleryCell),
    a11y: descriptors.map(surfaceA11y),
    docs: descriptors.map(surfaceDoc),
  };
}