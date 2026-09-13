import { exec } from 'node:child_process';
import { access, appendFile, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { EpisodicMemory } from '@senars/util';
import { z } from 'zod';
import type { ApprovalService } from '../ApprovalService.js';
import type { ToolResult } from '../engine/Engine.js';
import type { ToolSpec } from './ToolRegistry.js';
import { duckDuckGoSearch, tavilySearch, webFetch } from './web-tools.js';
import { withinWorkspace } from './workspace.js';

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
    description:
      'Requests human approval for critical actions (code write, config change, destructive command). Blocks until approved/rejected.',
    parameters: {
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
        return ok({
          success: result.approved,
          approved: result.approved,
          feedback: result.feedback,
        });
      } catch (err: unknown) {
        return fail(`Approval error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

export interface BuiltinDeps {
  episodic?: EpisodicMemory;
  metta?: (expression: string) => Promise<unknown[]>;
  pins?: PinStore;
}

export interface PinStore {
  pin(key: string, value: string): void;
  unpin(key?: string): void;
  recallAll(): Map<string, string>;
}

const within = (filename: string): ToolResult | null =>
  withinWorkspace(filename) ? null : fail(`Path outside workspace rejected: ${filename}`);

export const createBuiltinTools = (deps: BuiltinDeps = {}): ToolSpec[] => [
  {
    name: 'send',
    description: 'Send a text response to the user',
    parameters: {
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
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('remember requires content');
      const content = parseJsonArg(first);
      if (!deps.episodic) return fail('episodic memory not configured');
      await deps.episodic.log('input', content, { via: 'remember' });
      return ok({ stored: true, content });
    },
  },
  {
    name: 'query',
    description: 'Query episodic memory',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('query requires a search term');
      const query = parseJsonArg(first);
      if (!deps.episodic) return fail('episodic memory not configured');
      const episodes = await deps.episodic.search(query, 10);
      return ok({ query, episodes });
    },
  },
  {
    name: 'episodes',
    description: 'List recent episodic memories',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      const limit = first ? Number.parseInt(parseJsonArg(first), 10) : 10;
      if (!deps.episodic) return fail('episodic memory not configured');
      return ok({ episodes: await deps.episodic.getRecent(limit), limit });
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the filesystem',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('read_file requires a filename');
      const filename = parseJsonArg(first);
      const sandbox = within(filename);
      if (sandbox) return sandbox;
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
    name: 'write_file',
    description: 'Write content to a file',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const filename = getFirstArg(args);
      const content = getSecondArg(args);
      if (!filename || !content) return fail('write_file requires filename and content');
      const target = parseJsonArg(filename);
      const sandbox = within(target);
      if (sandbox) return sandbox;
      try {
        await writeFile(target, content, 'utf-8');
        return ok({ filename: target, written: content.length });
      } catch (e) {
        return fail(`Cannot write file: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'append_file',
    description: 'Append content to a file',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const filename = getFirstArg(args);
      const content = getSecondArg(args);
      if (!filename || !content) return fail('append_file requires filename and content');
      const target = parseJsonArg(filename);
      const sandbox = within(target);
      if (sandbox) return sandbox;
      try {
        await appendFile(target, content, 'utf-8');
        return ok({ filename: target, appended: content.length });
      } catch (e) {
        return fail(`Cannot append to file: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'search',
    description: 'Search the web (tavily when TAVILY_API_KEY is set, else DuckDuckGo)',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('search requires a query');
      const query = parseJsonArg(first);
      const chain: Array<{
        via: string;
        run: () => Promise<Awaited<ReturnType<typeof duckDuckGoSearch>>>;
      }> = [];
      if (process.env.TAVILY_API_KEY) {
        chain.push({
          via: 'tavily',
          run: () => tavilySearch(query, process.env.TAVILY_API_KEY as string),
        });
      }
      chain.push({ via: 'duckduckgo', run: () => duckDuckGoSearch(query) });
      for (const { via, run } of chain) {
        try {
          const results = await run();
          return ok({ query, via, results });
        } catch {
          // fall through to the next provider in the chain
        }
      }
      return ok({ query, via: 'none', results: [], note: 'all search providers failed' });
    },
  },
  {
    name: 'shell',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('shell requires a command');
      const cmd = parseJsonArg(first);
      const run = promisify(exec);
      try {
        const { stdout } = await run(cmd, { encoding: 'utf-8', timeout: 30000 });
        return ok({ command: cmd, exitCode: 0, stdout: stdout.trimEnd() });
      } catch (e: unknown) {
        const err = e as Error & { stdout?: string; stderr?: string; killed?: boolean };
        return ok({
          command: cmd,
          exitCode: err.killed ? 124 : -1,
          stdout: ((err.stdout as string) ?? '').trimEnd(),
          stderr: err.killed
            ? ((err.stderr as string) ?? '').trimEnd() || 'Command timed out'
            : ((err.stderr as string) ?? '').trimEnd(),
        });
      }
    },
  },
  {
    name: 'metta',
    description: 'Evaluate a MeTTa expression',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('metta requires an expression');
      const expression = parseJsonArg(first);
      if (!deps.metta) return fail('metta engine not configured');
      return ok({ expression, result: await deps.metta(expression) });
    },
  },
  {
    name: 'pin',
    description:
      'Pin a value for retention: `pin <key> <value>` stores; `pin <key>` unpins; `pin --list` lists',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const [first, second] = getArgs(args);
      if (!deps.pins) return fail('pin store not configured');
      if (!first || parseJsonArg(first) === '--list') {
        const entries = [...deps.pins.recallAll().entries()].map(([key, value]) => ({
          key,
          value,
        }));
        return ok({ pinned: entries });
      }
      const key = parseJsonArg(first);
      if (second === undefined) {
        deps.pins.unpin(key);
        return ok({ unpinned: key });
      }
      const value = parseJsonArg(second);
      deps.pins.pin(key, value);
      return ok({ pinned: key, value });
    },
  },
  {
    name: 'tavily_search',
    description: 'Search the web via Tavily API (requires TAVILY_API_KEY)',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('tavily_search requires a query');
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey)
        return ok({ query: parseJsonArg(first), results: [], note: 'TAVILY_API_KEY not set' });
      try {
        const results = await tavilySearch(parseJsonArg(first), apiKey);
        return ok({ query: parseJsonArg(first), via: 'tavily', results });
      } catch (e) {
        return fail(`tavily_search failed: ${(e as Error).message}`);
      }
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch a web page read-only and return its text content',
    parameters: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
    },
    execute: async (args: CmdArgSet): Promise<ToolResult> => {
      const first = getFirstArg(args);
      if (!first) return fail('web_fetch requires a URL');
      try {
        return ok(await webFetch(parseJsonArg(first)));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  },
];

export const BUILTIN_TOOLS: ToolSpec[] = createBuiltinTools();

export function registerBuiltinTools(
  registry: { register: (spec: ToolSpec) => void },
  approvalService?: ApprovalService,
  deps?: BuiltinDeps
): void {
  for (const tool of createBuiltinTools(deps ?? {})) {
    registry.register(tool);
  }
  if (approvalService) {
    registry.register(createRequestApprovalTool(approvalService));
  }
}
