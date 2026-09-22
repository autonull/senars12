import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';

// --- codemod ---

export interface CodemodDeps {
  workspaceRoot?: string;
}

export interface CodemodResult {
  success: boolean;
  diff?: string;
  files: string[];
  applied: boolean;
  error?: string;
  matches?: number;
}

export interface CodemodOptions {
  pattern: string;
  replacement: string;
  scope?: string[];
  dryRun?: boolean;
  lang?: string;
}

function findAstGrep(): string {
  const candidates = [
    'ast-grep',
    'sg',
    `${process.env.HOME}/.cargo/bin/ast-grep`,
    `${process.env.HOME}/.cargo/bin/sg`,
  ];
  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ['--version'], { stdio: 'pipe' });
      if (result.status === 0) return cmd;
    } catch {
      // ignore
    }
  }
  return 'ast-grep';
}

export async function runCodemod(
  workspaceRoot: string,
  options: CodemodOptions,
  dryRun: boolean
): Promise<CodemodResult> {
  const { pattern, replacement, scope = [], lang = 'typescript' } = options;
  const astGrepCmd = findAstGrep();

  const paths = scope.length > 0 ? scope.map((s) => resolve(workspaceRoot, s)) : [workspaceRoot];

  const args = ['run', '--pattern', pattern, '--lang', lang, '--rewrite', replacement, ...paths];

  if (dryRun) {
    args.push('--json');
  } else {
    args.push('--update-all', '--json');
  }

  return new Promise((resolve) => {
    const child = spawn(astGrepCmd, args, {
      cwd: workspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let _stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      _stderr += data.toString();
    });

    child.on('close', (exitCode: number) => {
      try {
        const matches: any[] = stdout ? JSON.parse(stdout) : [];
        const files: string[] = Array.from(new Set(matches.map((m) => m.file))).filter(
          (f) => f !== 'STDIN'
        );

        // Generate unified diff
        let diff = '';
        if (matches.length > 0) {
          for (const match of matches) {
            diff += `${match.file}\n`;
            diff += `@@ -${match.range.start.line + 1},${match.range.end.line - match.range.start.line + 1} +${match.range.start.line + 1},${match.range.end.line - match.range.start.line + 1} @@\n`;
            diff += `-${match.lines}\n`;
            diff += `+${match.replacement}\n`;
          }
        }

        resolve({
          success: exitCode === 0,
          diff: diff || undefined,
          files,
          applied: !dryRun && exitCode === 0,
          matches: matches.length,
        });
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse ast-grep output: ${String(error)}`,
          files: [],
          applied: false,
        });
      }
    });

    child.on('error', (error: Error) => {
      resolve({
        success: false,
        error: String(error),
        files: [],
        applied: false,
      });
    });
  });
}

export function createCodemodTools(deps: CodemodDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();

  return {
    codemod: tool({
      description:
        'Apply structural code modifications using ast-grep. Supports pattern-based search and replace with metavariables (e.g., $X, $V). Returns diff and list of affected files.',
      inputSchema: z.object({
        pattern: z.string().describe('AST pattern to match (e.g., "let $X: any = $V")'),
        replacement: z
          .string()
          .describe('Replacement pattern using metavariables (e.g., "let $X: unknown = $V")'),
        scope: z
          .array(z.string())
          .optional()
          .default([])
          .describe('File/directory paths to limit search (relative to workspace root)'),
        dryRun: z
          .boolean()
          .optional()
          .default(true)
          .describe('If true, only show diff without applying changes'),
        lang: z
          .string()
          .optional()
          .default('typescript')
          .describe('Language for AST parsing (typescript, javascript, python, etc.)'),
      }),
      execute: async ({ pattern, replacement, scope = [], dryRun = true, lang = 'typescript' }) => {
        return runCodemod(workspaceRoot, { pattern, replacement, scope, lang }, dryRun);
      },
    }),
  };
}

// ============================================================================
// SELF-TOOLS: Autonomous Self-Improvement Tools with Shadow Execution
// ============================================================================
