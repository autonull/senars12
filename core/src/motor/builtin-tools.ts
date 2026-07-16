import type { ToolSpec } from './ToolRegistry.js';
import type { ToolResult } from '../engine/Engine.js';
import { execSync } from 'node:child_process';
import { readFile, writeFile, appendFile, access } from 'node:fs/promises';

export type CmdArgSet = Record<string, unknown>;

function ok(content: unknown): ToolResult {
  return { success: true, content };
}

function fail(error: string): ToolResult {
  return { success: false, content: null, error };
}

function parseJsonArg(raw: string): string {
  try { return JSON.parse(raw); } catch { return raw.replace(/^"|"$/g, ''); }
}

export const BUILTIN_TOOLS: ToolSpec[] = [
  {
    name: 'send',
    description: 'Send a text response to the user',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('send requires text');
      return ok({ text: parseJsonArg(a[0]!) });
    },
  },
  {
    name: 'remember',
    description: 'Store something in episodic memory',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('remember requires content');
      const content = parseJsonArg(a[0]!);
      return ok({ stored: true, content });
    },
  },
  {
    name: 'query',
    description: 'Query knowledge or memory',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('query requires a search term');
      return ok({ query: parseJsonArg(a[0]!), result: 'query submitted (async)' });
    },
  },
  {
    name: 'episodes',
    description: 'List recent episodic memories',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      const limit = a && a[0] ? parseInt(parseJsonArg(a[0]!), 10) : 10;
      return ok({ episodes: [], limit });
    },
  },
  {
    name: 'read-file',
    description: 'Read a file from the filesystem',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('read-file requires a filename');
      const filename = parseJsonArg(a[0]!);
      try {
        await access(filename);
        const content = await readFile(filename, 'utf-8');
        return ok({ filename, size: content.length, content });
      } catch (e) {
        return fail(`Cannot read file: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'write-file',
    description: 'Write content to a file',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length < 2) return fail('write-file requires filename and content');
      const filename = parseJsonArg(a[0]!);
      const content = parseJsonArg(a[1]!);
      try {
        await writeFile(filename, content, 'utf-8');
        return ok({ filename, written: content.length });
      } catch (e) {
        return fail(`Cannot write file: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'append-file',
    description: 'Append content to a file',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length < 2) return fail('append-file requires filename and content');
      const filename = parseJsonArg(a[0]!);
      const content = parseJsonArg(a[1]!);
      try {
        await appendFile(filename, content, 'utf-8');
        return ok({ filename, appended: content.length });
      } catch (e) {
        return fail(`Cannot append to file: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'search',
    description: 'Search for information (web search placeholder)',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('search requires a query');
      return ok({ query: parseJsonArg(a[0]!), results: [], type: 'web-search' });
    },
  },
  {
    name: 'shell',
    description: 'Execute a shell command',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('shell requires a command');
      const cmd = parseJsonArg(a[0]!);
      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
        return ok({ command: cmd, exitCode: 0, stdout: output.trimEnd() });
      } catch (e: unknown) {
        const err = e as Error & { stdout?: string; stderr?: string; status?: number };
        return ok({
          command: cmd,
          exitCode: err.status ?? -1,
          stdout: (err.stdout as string ?? '').trimEnd(),
          stderr: (err.stderr as string ?? '').trimEnd(),
        });
      }
    },
  },
  {
    name: 'metta',
    description: 'Evaluate a MeTTa expression',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('metta requires an expression');
      return ok({ expression: parseJsonArg(a[0]!), result: 'metta evaluation delegated to engine' });
    },
  },
  {
    name: 'pin',
    description: 'Pin a belief for retention',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('pin requires content');
      return ok({ pinned: parseJsonArg(a[0]!) });
    },
  },
  {
    name: 'tavily-search',
    description: 'Search the web via Tavily API',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('tavily-search requires a query');
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return ok({ query: parseJsonArg(a[0]!), results: [], note: 'TAVILY_API_KEY not set' });
      return ok({ query: parseJsonArg(a[0]!), results: [], type: 'tavily' });
    },
  },
  {
    name: 'technical-analysis',
    description: 'Perform technical analysis on a symbol or concept',
    inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } } },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const a = args.args as string[] | undefined;
      if (!a || a.length === 0) return fail('technical-analysis requires a target');
      return ok({ target: parseJsonArg(a[0]!), analysis: 'technical analysis placeholder' });
    },
  },
];

export function registerBuiltinTools(registry: { register: (spec: ToolSpec) => void }): void {
  for (const tool of BUILTIN_TOOLS) {
    registry.register(tool);
  }
}
