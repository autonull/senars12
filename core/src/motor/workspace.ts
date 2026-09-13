import path from 'node:path';

/** Workspace root for motor tool sandboxing (defaults to process cwd). */
export const WORKSPACE_ROOT = process.cwd();

/** True when an absolute path resolves inside the workspace root. */
export const withinWorkspace = (p: string): boolean => {
  const abs = path.resolve(p);
  return abs === WORKSPACE_ROOT || abs.startsWith(WORKSPACE_ROOT + path.sep);
};
