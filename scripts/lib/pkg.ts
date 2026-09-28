import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ExportTarget {
  types?: string;
  import?: string;
  default?: string;
}

export type ExportEntry = string | ExportTarget;

export interface PackageJson {
  name?: string;
  exports?: Record<string, ExportEntry>;
}

/** Reads a workspace package manifest, or `null` when the package is absent. */
export const readPackageJson = (root: string, pkgDir: string): PackageJson | null => {
  const pkgPath = join(root, pkgDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
};

/** Subpath exports of a workspace package, or `{}` when absent/undeclared. */
export const readExports = (root: string, pkgDir: string): Record<string, ExportEntry> =>
  readPackageJson(root, pkgDir)?.exports ?? {};

/** Filesystem target(s) of an export entry; empty for dynamic subpaths. */
export const entryTargets = (entry: ExportEntry): string[] => {
  if (typeof entry === 'string') return [entry];
  const { types, import: imp, default: def } = entry;
  return [types, imp, def].filter((x): x is string => typeof x === 'string');
};
