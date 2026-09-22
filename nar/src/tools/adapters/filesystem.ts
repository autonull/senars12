import { readFile, writeFile } from 'node:fs/promises';
import { normalize, resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

// --- fs_read / fs_write ---

export interface FileSystemDeps {
  workspaceRoot: string;
  maxReadSize?: number;
}

function enforceWorkspaceScope(requestedPath: string, workspaceRoot: string): string {
  const resolved = resolve(workspaceRoot, requestedPath);
  const normalized = normalize(resolved);
  const normalizedRoot = normalize(workspaceRoot);
  if (!normalized.startsWith(normalizedRoot)) {
    throw new Error(`Path must be within workspace: ${workspaceRoot}`);
  }
  return normalized;
}

export function createFileSystemTools(deps: FileSystemDeps) {
  const maxReadSize = deps.maxReadSize ?? 1_048_576; // 1MB default

  return {
    fs_read: tool({
      description: 'Read a file from the workspace. Returns file contents as text.',
      inputSchema: z.strictObject({
        path: z.string().describe('File path relative to workspace root'),
      }),
      execute: async ({ path }) => {
        try {
          const resolvedPath = enforceWorkspaceScope(path, deps.workspaceRoot);
          const stat = await import('node:fs/promises').then((m) => m.stat(resolvedPath));
          if (!stat.isFile()) return { error: 'Not a file', path };
          if (stat.size > maxReadSize)
            return {
              error: `File too large (${stat.size} bytes, max ${maxReadSize})`,
              path,
            };
          const content = await readFile(resolvedPath, 'utf-8');
          return { content, path, size: content.length };
        } catch (error) {
          return { error: String(error), path };
        }
      },
    }),

    fs_write: tool({
      description:
        'Write content to a file in the workspace. Creates parent directories if needed.',
      inputSchema: z.strictObject({
        path: z.string().describe('File path relative to workspace root'),
        content: z.string().describe('Content to write'),
      }),
      execute: async ({ path, content }) => {
        try {
          const resolvedPath = enforceWorkspaceScope(path, deps.workspaceRoot);
          const { mkdir } = await import('node:fs/promises');
          const { dirname } = await import('node:path');
          await mkdir(dirname(resolvedPath), { recursive: true });
          await writeFile(resolvedPath, content, 'utf-8');
          return { written: content.length, path };
        } catch (error) {
          return { error: String(error), path };
        }
      },
    }),
  };
}
