import { exec } from 'node:child_process';
import { access, appendFile, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { EpisodicMemory } from '@senars/util';
import { errMsg, toolError, toolOk } from '@senars/util';
import { z } from 'zod';
import type { ApprovalService } from '../ApprovalService.js';
import type { ToolResult } from '../engine/Engine.js';
import type { ToolSpec } from './ToolRegistry.js';
import {
  braveApiKey,
  braveSearch,
  searchWeb,
  tavilySearch,
  type WebSearchResult,
  webFetch,
} from './web-search.js';
import { withinWorkspace } from './workspace.js';

export type CmdArgSet = Record<string, unknown>;

const ARGS_SCHEMA = {
  type: 'object',
  properties: { args: { type: 'array', items: { type: 'string' } } },
} as unknown as Record<string, unknown>;

const cmdArgs = (args: CmdArgSet): string[] => (args.args as string[]) ?? [];
const argAt = (args: CmdArgSet, index: number): string | undefined => cmdArgs(args)[index];
const textAt = (args: CmdArgSet, index: number): string | undefined => {
  const raw = argAt(args, index);
  return raw === undefined ? undefined : parseJsonArg(raw);
};
const missing = (tool: string, what: string): ToolResult => toolError(`${tool} requires ${what}`);

const defineCmd = (
  name: string,
  description: string,
  execute: (args: CmdArgSet) => Promise<ToolResult> | ToolResult
): ToolSpec => ({ name, description, parameters: ARGS_SCHEMA, execute: async (a) => execute(a) });

function parseJsonArg(raw: string): string {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^"|"$/g, '');
  }
}

/**
 * The single-provider tools (`tavily_search`, `brave_search`) share this: a
 * missing key is a reported note rather than a failure, so an unconfigured
 * deployment degrades to "no results" instead of an error.
 */
async function keyedProvider(
  rawQuery: string,
  via: string,
  apiKey: string | undefined,
  run: (query: string, apiKey: string) => Promise<WebSearchResult[]>
): Promise<ToolResult> {
  const query = parseJsonArg(rawQuery);
  if (!apiKey) return toolOk({ query, results: [], note: `${via.toUpperCase()}_API_KEY not set` });
  try {
    return toolOk({ query, via, results: await run(query, apiKey) });
  } catch (e) {
    return toolError(`${via}_search failed: ${errMsg(e)}`);
  }
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
        return toolOk({
          success: result.approved,
          approved: result.approved,
          feedback: result.feedback,
        });
      } catch (err: unknown) {
        return toolError(`Approval error: ${errMsg(err)}`);
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
  withinWorkspace(filename) ? null : toolError(`Path outside workspace rejected: ${filename}`);

const runShell = promisify(exec);

const persistFile = async (
  tool: 'write_file' | 'append_file',
  target: string,
  content: string
): Promise<ToolResult> => {
  const sandbox = within(target);
  if (sandbox) return sandbox;
  const verb = tool === 'write_file' ? 'write' : 'append to';
  const key = tool === 'write_file' ? 'written' : 'appended';
  try {
    if (tool === 'write_file') await writeFile(target, content, 'utf-8');
    else await appendFile(target, content, 'utf-8');
    return toolOk({ filename: target, [key]: content.length });
  } catch (e) {
    return toolError(`Cannot ${verb} file: ${errMsg(e)}`);
  }
};

const requireEpisodic = (deps: BuiltinDeps): ToolResult | null =>
  deps.episodic ? null : toolError('episodic memory not configured');

export const createBuiltinTools = (deps: BuiltinDeps = {}): ToolSpec[] => [
  defineCmd('send', 'Send a text response to the user', (args) => {
    const text = textAt(args, 0);
    return text ? toolOk({ text }) : missing('send', 'text');
  }),
  defineCmd('remember', 'Store something in episodic memory', async (args) => {
    const content = textAt(args, 0);
    if (!content) return missing('remember', 'content');
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    await deps.episodic!.log('input', content, { via: 'remember' });
    return toolOk({ stored: true, content });
  }),
  defineCmd('query', 'Query episodic memory', async (args) => {
    const query = textAt(args, 0);
    if (!query) return missing('query', 'a search term');
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    return toolOk({ query, episodes: await deps.episodic!.search(query, 10) });
  }),
  defineCmd('episodes', 'List recent episodic memories', async (args) => {
    const unavailable = requireEpisodic(deps);
    if (unavailable) return unavailable;
    const limit = Number.parseInt(textAt(args, 0) ?? '10', 10);
    return toolOk({ episodes: await deps.episodic!.getRecent(limit), limit });
  }),
  defineCmd('read_file', 'Read a file from the filesystem', async (args) => {
    const filename = textAt(args, 0);
    if (!filename) return missing('read_file', 'a filename');
    const sandbox = within(filename);
    if (sandbox) return sandbox;
    try {
      await access(filename);
      const content = await readFile(filename, 'utf-8');
      return toolOk({ filename, size: content.length, content });
    } catch (e) {
      return toolError(`Cannot read file: ${errMsg(e)}`);
    }
  }),
  defineCmd('write_file', 'Write content to a file', (args) => {
    const filename = argAt(args, 0);
    const content = argAt(args, 1);
    if (!filename || !content) return missing('write_file', 'filename and content');
    return persistFile('write_file', parseJsonArg(filename), content);
  }),
  defineCmd('append_file', 'Append content to a file', (args) => {
    const filename = argAt(args, 0);
    const content = argAt(args, 1);
    if (!filename || !content) return missing('append_file', 'filename and content');
    return persistFile('append_file', parseJsonArg(filename), content);
  }),
  defineCmd(
    'search',
    'Search the web (Tavily, then Brave, then DuckDuckGo — whichever is configured)',
    async (args) => {
      const query = textAt(args, 0);
      if (!query) return missing('search', 'a query');
      return toolOk(await searchWeb(query));
    }
  ),
  defineCmd('shell', 'Execute a shell command', async (args) => {
    const cmd = textAt(args, 0);
    if (!cmd) return missing('shell', 'a command');
    try {
      const { stdout } = await runShell(cmd, { encoding: 'utf-8', timeout: 30000 });
      return toolOk({ command: cmd, exitCode: 0, stdout: stdout.trimEnd() });
    } catch (e: unknown) {
      const err = e as Error & { stdout?: string; stderr?: string; killed?: boolean };
      return toolOk({
        command: cmd,
        exitCode: err.killed ? 124 : -1,
        stdout: (err.stdout ?? '').trimEnd(),
        stderr: (err.stderr ?? '').trimEnd() || (err.killed ? 'Command timed out' : ''),
      });
    }
  }),
  defineCmd('metta', 'Evaluate a MeTTa expression', async (args) => {
    const expression = textAt(args, 0);
    if (!expression) return missing('metta', 'an expression');
    if (!deps.metta) return toolError('metta engine not configured');
    return toolOk({ expression, result: await deps.metta(expression) });
  }),
  defineCmd(
    'pin',
    'Pin a value for retention: `pin <key> <value>` stores; `pin <key>` unpins; `pin --list` lists',
    (args) => {
      if (!deps.pins) return toolError('pin store not configured');
      const first = textAt(args, 0);
      if (!first || first === '--list') {
        const entries = [...deps.pins.recallAll().entries()].map(([key, value]) => ({
          key,
          value,
        }));
        return toolOk({ pinned: entries });
      }
      const second = textAt(args, 1);
      if (second === undefined) {
        deps.pins.unpin(first);
        return toolOk({ unpinned: first });
      }
      deps.pins.pin(first, second);
      return toolOk({ pinned: first, value: second });
    }
  ),
  defineCmd('tavily_search', 'Search the web via Tavily API (requires TAVILY_API_KEY)', (args) => {
    const first = argAt(args, 0);
    if (!first) return missing('tavily_search', 'a query');
    return keyedProvider(first, 'tavily', process.env.TAVILY_API_KEY, tavilySearch);
  }),
  defineCmd('brave_search', 'Search the web via Brave Search API (requires BRAVE_API_KEY)', (args) => {
    const first = argAt(args, 0);
    if (!first) return missing('brave_search', 'a query');
    return keyedProvider(first, 'brave', braveApiKey(), braveSearch);
  }),
  defineCmd('web_fetch', 'Fetch a web page read-only and return its text content', async (args) => {
    const url = textAt(args, 0);
    if (!url) return missing('web_fetch', 'a URL');
    try {
      return toolOk(await webFetch(url));
    } catch (e) {
      return toolError(e);
    }
  }),
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
