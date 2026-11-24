import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root — resolved from this file's location, so cwd never matters. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Absolute path under the repository root. */
export const fromRoot = (...segments: string[]): string => resolve(ROOT, ...segments);
