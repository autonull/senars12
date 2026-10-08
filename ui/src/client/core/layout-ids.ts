/**
 * The layout-id leaf (§2.6 validation). `layout-registry` publishes each layout
 * it registers here; `store` reads the set to validate a URL `layout` without
 * importing the registry — which imports the `core/index` barrel and so closes
 * the `core/index → store` cycle that layout validation cannot afford.
 */

const registered = new Set<string>();

export const registerLayoutId = (id: string): void => {
  registered.add(id);
};

export const registeredLayoutIds = (): string[] => [...registered];

export const isRegisteredLayoutId = (id: string): boolean => registered.has(id);
