/**
 * The Studio — the one parametric app.
 *
 * It is not a component: it is a composition app registration. The shell owns
 * its chrome and its grid, reads the composition from the URL, and mounts the
 * surfaces each preset names. Adding an app is adding a row of data.
 */

import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import { DEFAULT_STUDIO_COMPOSITION, registerStudioPresets } from './presets.js';

registerStudioPresets();

/** Studio app descriptor — a composition app: chrome + grid, all data-driven. */
export const STUDIO_APP: AppDescriptor<'studio'> = defineApp({
  bundle: defineBundle({
    id: 'studio',
    name: 'Studio',
    description: 'Compose any workspace from surfaces',
    surfaces: {},
  }),
  icon: 'dashboard',
  composition: DEFAULT_STUDIO_COMPOSITION,
  connection: { url: '/ws', reconnect: true },
  capability: 'language',
});

export { STUDIO_PRESETS, DEFAULT_STUDIO_COMPOSITION } from './presets.js';
