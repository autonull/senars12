import path from 'node:path';
import { containsPath } from '@senars/util/fs';
/** Workspace root for motor tool sandboxing (defaults to process cwd). */
export const WORKSPACE_ROOT = process.cwd();
/** True when an absolute path resolves inside the workspace root. */
export const withinWorkspace = (p) => containsPath(WORKSPACE_ROOT, path.resolve(p));
