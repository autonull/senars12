import { execSync } from 'node:child_process';
import { access, appendFile, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { ToolResult } from '../engine/Engine.js';
import type { ToolSpec } from './ToolRegistry.js';
import { ApprovalService } from '../ApprovalService.js';

export type CmdArgSet = Record<string, unknown>;

function ok(content: unknown): ToolResult {
  return { success: true, content };
}

function fail(error: string): ToolResult {
  return { success: false, content: null, error };
}

function parseJsonArg(raw: string): string {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^"|"$/g, '');
  }
}

function getArgs(args: CmdArgSet): string[] {
  return (args.args as string[]) ?? [];
}

function getFirstArg(args: CmdArgSet): string | undefined {
  return getArgs(args)[0];
}

function getSecondArg(args: CmdArgSet): string | undefined {
  return getArgs(args)[1];
}

function createRequestApprovalTool(approvalService: ApprovalService): ToolSpec {
  const schema = z.object({
    actionDescription: z.string().describe('Description of the action requiring approval'),
    diffOrPayload: z.string().describe('The diff, payload, or details of the action'),
    riskLevel: z.enum(['low', 'medium', 'high']).describe('Risk level of the action'),
    timeoutMs: z.number().optional().default(60000).describe('Timeout in milliseconds'),
  });

  return {
    name: 'request_approval',
    description: 'Requests human approval for critical actions (code write, config change, destructive command). Blocks until approved/rejected.',
    inputSchema: {
      type: 'object',
      properties: {
        actionDescription: { type: 'string' },
        diffOrPayload: { type: 'string' },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        timeoutMs: { type: 'number', default: 60000 },
      },
      required: ['actionDescription', 'diffOrPayload', 'riskLevel'],
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      try {
        const parsed = schema.parse(args);
        const result = await approvalService.requestApproval({
          action: parsed.actionDescription,
          payload: parsed.diffOrPayload,
          risk: parsed.riskLevel,
          timeoutMs: parsed.timeoutMs,
        });
        return ok({ success: result.approved, approved: result.approved, feedback: result.feedback });
      } catch (err: any) {
        return fail(`Approval error: ${err.message}`);
      }
    },
  };
}

export const BUILTIN_TOOLS: ToolSpec[] = [
  {
    name: 'send',
    description: 'Send a text response to the user',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('send requires text');
      return ok({ text: parseJsonArg(first) });
    },
  },
  {
    name: 'remember',
    description: 'Store something in episodic memory',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('remember requires content');
      const content = parseJsonArg(first);
      return ok({ stored: true, content });
    },
  },
  {
    name: 'query',
    description: 'Query knowledge or memory',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('query requires a search term');
      return ok({ query: parseJsonArg(first), result: 'query submitted (async)' });
    },
  },
  {
    name: 'episodes',
    description: 'List recent episodic memories',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      const limit = first ? Number.parseInt(parseJsonArg(first), 10) : 10;
      return ok({ episodes: [], limit });
    },
  },
  {
    name: 'read-file',
    description: 'Read a file from the filesystem',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('read-file requires a filename');
      const filename = parseJsonArg(first);
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
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const filename = getFirstArg(args);
      const content = getSecondArg(args);
      if (!filename || !content) return fail('write-file requires filename and content');
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
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const filename = getFirstArg(args);
      const content = getSecondArg(args);
      if (!filename || !content) return fail('append-file requires filename and content');
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
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('search requires a query');
      return ok({ query: parseJsonArg(first), results: [], type: 'web-search' });
    },
  },
  {
    name: 'shell',
    description: 'Execute a shell command',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('shell requires a command');
      const cmd = parseJsonArg(first);
      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
        return ok({ command: cmd, exitCode: 0, stdout: output.trimEnd() });
      } catch (e: unknown) {
        const err = e as Error & { stdout?: string; stderr?: string; status?: number };
        return ok({
          command: cmd,
          exitCode: err.status ?? -1,
          stdout: ((err.stdout as string) ?? '').trimEnd(),
          stderr: ((err.stderr as string) ?? '').trimEnd(),
        });
      }
    },
  },
  {
    name: 'metta',
    description: 'Evaluate a MeTTa expression',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('metta requires an expression');
      return ok({
        expression: parseJsonArg(first),
        result: 'metta evaluation delegated to engine',
      });
    },
  },
  {
    name: 'pin',
    description: 'Pin a belief for retention',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('pin requires content');
      return ok({ pinned: parseJsonArg(first) });
    },
  },
  {
    name: 'tavily-search',
    description: 'Search the web via Tavily API',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('tavily-search requires a query');
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey)
        return ok({ query: parseJsonArg(first), results: [], note: 'TAVILY_API_KEY not set' });
      return ok({ query: parseJsonArg(first), results: [], type: 'tavily' });
    },
  },
  {
    name: 'technical-analysis',
    description: 'Perform technical analysis on a symbol or concept',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('technical-analysis requires a target');
      return ok({ target: parseJsonArg(first), analysis: 'technical analysis placeholder' });
    },
  },
];

export function registerBuiltinTools(
  registry: { register: (spec: ToolSpec) => void },
  approvalService?: ApprovalService
): void {
  for (const tool of BUILTIN_TOOLS) {
    registry.register(tool);
  }
  if (approvalService) {
    registry.register(createRequestApprovalTool(approvalService));
  }
}
