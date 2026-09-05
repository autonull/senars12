import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { normalize, resolve, dirname } from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import * as fc from 'fast-check';
import type { EpisodicMemory } from '../../memory/EpisodicMemory.js';
import type { EmbeddingGenerator } from '../../memory/embedding.js';
import { cosineSimilarity, createEmbeddingGenerator } from '../../memory/embedding.js';
import { ToolSpecSchema, ConnectionConfigSchema, AgentOptionsSchema } from '../schemas.js';

type ToolSpec = z.infer<typeof ToolSpecSchema>;
type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;
type AgentOptions = z.infer<typeof AgentOptionsSchema>;

// --- web_search ---

export interface WebSearchDeps {
  apiKey?: string;
}

export function createWebSearchTools(deps: WebSearchDeps = {}) {
  const apiKey = deps.apiKey || process.env.BRAVE_API_KEY || process.env.WEB_SEARCH_API_KEY || '';

  return {
    web_search: tool({
      description: 'Search the web for current information. Returns snippets and URLs.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        count: z.number().min(1).max(20).optional().default(5).describe('Number of results (1-20)'),
      }),
      execute: async ({ query, count }) => {
        if (!apiKey) {
          return {
            error: 'Web search is not configured. Set BRAVE_API_KEY or WEB_SEARCH_API_KEY.',
            results: [],
          };
        }
        try {
          const url = new URL('https://api.search.brave.com/res/v1/web/search');
          url.searchParams.set('q', query);
          url.searchParams.set('count', String(count));
          const response = await fetch(url.toString(), {
            headers: {
              Accept: 'application/json',
              'X-Subscription-Token': apiKey,
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(`Search API error: ${response.status}`);
          const data = (await response.json()) as {
            web?: { results?: Array<{ title: string; url: string; description: string }> };
          };
          const results = (data.web?.results ?? []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
          }));
          return { results, count: results.length, query };
        } catch (error) {
          return { error: String(error), results: [], query };
        }
      },
    }),
  };
}

// --- http_fetch ---

export function createHTTPFetchTools() {
  return {
    http_fetch: tool({
      description:
        'Make HTTP requests. Supports GET, POST, PUT, DELETE. Returns status, headers, and body.',
      inputSchema: z.object({
        url: z.string().describe('Full URL to fetch (http/https only)'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET'),
        headers: z.record(z.string(), z.string()).optional().describe('Optional request headers'),
        body: z.string().optional().describe('Request body for POST/PUT'),
        timeout: z
          .number()
          .min(1000)
          .max(60_000)
          .optional()
          .default(15_000)
          .describe('Timeout in ms'),
      }),
      execute: async ({ url: urlStr, method = 'GET', headers = {}, body, timeout = 15_000 }) => {
        try {
          const parsed = new URL(urlStr);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { error: 'Only http/https URLs are allowed' };
          }
          const response = await fetch(urlStr, {
            method,
            headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body || undefined,
            signal: AbortSignal.timeout(timeout),
          });
          const bodyText = await response.text();
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: bodyText,
            bodyLength: bodyText.length,
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    }),
  };
}

// --- code_exec ---

export interface CodeExecDeps {
  workspaceRoot?: string;
  maxTimeout?: number;
  maxOutputBytes?: number;
}

export function createCodeExecTools(deps: CodeExecDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const maxTimeout = deps.maxTimeout ?? 120_000;
  const maxOutputBytes = deps.maxOutputBytes ?? 65_536;

  return {
    code_exec: tool({
      description:
        'Execute a command in a subprocess. Scoped to the workspace directory. No shell access.',
      inputSchema: z.object({
        command: z.string().describe('Command to execute (e.g., "node", "python3", "ls")'),
        args: z.array(z.string()).optional().default([]).describe('Command arguments'),
        cwd: z.string().optional().describe('Working directory relative to workspace root'),
        timeout: z
          .number()
          .min(1000)
          .max(maxTimeout)
          .optional()
          .default(30_000)
          .describe('Timeout in ms'),
      }),
      execute: async ({ command, args = [], cwd, timeout = 30_000 }) => {
        const execCwd = cwd ? resolve(workspaceRoot, cwd) : workspaceRoot;
        const normCwd = normalize(execCwd);
        if (!normCwd.startsWith(normalize(workspaceRoot))) {
          return { error: `Working directory must be within workspace: ${workspaceRoot}` };
        }

        return new Promise((resolve) => {
          const child = spawn(command, args, {
            cwd: normCwd,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          const stdout: Buffer[] = [];
          const stderr: Buffer[] = [];
          let truncated = false;

          const collect = (
            buffer: Buffer[],
            target: Buffer[],
            byteCount: {
              value: number;
            },
            maxBytes: number
          ) => {
            return (data: Buffer) => {
              const remaining = maxBytes - byteCount.value;
              if (remaining <= 0) {
                truncated = true;
                return;
              }
              const chunk = data.subarray(0, remaining);
              buffer.push(chunk);
              byteCount.value += chunk.length;
            };
          };

          child.stdout?.on('data', collect(stdout, stdout, { value: 0 }, maxOutputBytes));
          child.stderr?.on('data', collect(stderr, stderr, { value: 0 }, maxOutputBytes));

          const startTime = Date.now();
          const timer = setTimeout(() => {
            child.kill('SIGTERM');
          }, timeout);

          child.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({
              exitCode: exitCode ?? -1,
              stdout: Buffer.concat(stdout).toString('utf-8'),
              stderr: Buffer.concat(stderr).toString('utf-8'),
              duration: Date.now() - startTime,
              truncated,
            });
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            resolve({
              error: String(err),
              exitCode: -1,
              stdout: '',
              stderr: '',
              duration: Date.now() - startTime,
              truncated: false,
            });
          });
        });
      },
    }),
  };
}

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
      inputSchema: z.object({
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
      inputSchema: z.object({
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

// --- rag_query ---

export interface RagQueryDeps {
  episodicMemory?: EpisodicMemory;
  embeddingGenerator?: EmbeddingGenerator;
  topK?: number;
}

export function createRagQueryTools(deps: RagQueryDeps) {
  const embedder = deps.embeddingGenerator ?? createEmbeddingGenerator();
  const topK = deps.topK ?? 5;

  return {
    rag_query: tool({
      description:
        'Semantic search over episodic memory. Embeds the query and returns the most relevant past episodes by meaning, not just keywords.',
      inputSchema: z.object({
        query: z.string().describe('The search query for semantic matching'),
        limit: z.number().min(1).max(20).optional().default(topK).describe('Number of results'),
        typeFilter: z
          .enum(['input', 'response', 'belief_added', 'question', 'tool_call', 'error'])
          .optional()
          .describe('Optional episode type filter'),
      }),
      execute: async ({ query, limit = topK, typeFilter }) => {
        if (!deps.episodicMemory) {
          return { error: 'Episodic memory not available', results: [] };
        }
        try {
          const episodes = await deps.episodicMemory.getEpisodes({
            limit: 500,
            ...(typeFilter ? { type: typeFilter } : {}),
          });
          if (episodes.length === 0) {
            return { results: [], count: 0 };
          }
          const queryEmbedding = await embedder.generate(query);
          const scored: Array<{
            episode: { timestamp: number; type: string; content: string };
            score: number;
          }> = [];
          for (const ep of episodes) {
            const text = `${ep.content} ${Object.values(ep.metadata ?? {}).join(' ')}`;
            const emb = await embedder.generate(text);
            const score = cosineSimilarity(queryEmbedding, emb);
            if (score > 0.05) {
              scored.push({
                episode: { timestamp: ep.timestamp, type: ep.type, content: ep.content },
                score,
              });
            }
          }
          scored.sort((a, b) => b.score - a.score);
          const top = scored.slice(0, limit);
          return {
            results: top.map((r) => ({ ...r.episode, score: r.score })),
            count: top.length,
            totalScored: scored.length,
          };
        } catch (error) {
          return { error: String(error), results: [] };
        }
      },
    }),
  };
}

// --- human_approval ---

export interface ApprovalRequest {
  id: string;
  request: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  result: Promise<ApprovalResult>;
  resolve: (result: ApprovalResult) => void;
  reject: (error: Error) => void;
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

export interface ApprovalManagerOptions {
  onRequest?: (request: ApprovalRequest) => void;
}

export class ApprovalManager {
  private readonly pending = new Map<string, ApprovalRequest>();
  private readonly onRequest?: (request: ApprovalRequest) => void;

  constructor(opts: ApprovalManagerOptions = {}) {
    this.onRequest = opts.onRequest;
  }

  createRequest(request: string, metadata: Record<string, unknown> = {}): ApprovalRequest {
    const id = randomUUID();
    let resolveFn!: (result: ApprovalResult) => void;
    let rejectFn!: (error: Error) => void;
    const result = new Promise<ApprovalResult>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const req: ApprovalRequest = {
      id,
      request,
      metadata,
      createdAt: Date.now(),
      result,
      resolve: resolveFn,
      reject: rejectFn,
    };
    this.pending.set(id, req);
    this.onRequest?.(req);
    return req;
  }

  resolveApproval(id: string, approved: boolean, reason?: string): boolean {
    const req = this.pending.get(id);
    if (!req) return false;
    this.pending.delete(id);
    req.resolve({ approved, reason });
    return true;
  }

  rejectApproval(id: string, error: string): boolean {
    const req = this.pending.get(id);
    if (!req) return false;
    this.pending.delete(id);
    req.reject(new Error(error));
    return true;
  }

  getPending(): ApprovalRequest[] {
    return Array.from(this.pending.values());
  }

  getPendingCount(): number {
    return this.pending.size;
  }
}

export function createHumanApprovalTool(manager: ApprovalManager) {
  return {
    human_approval: tool({
      description:
        'Request human approval before proceeding with an action. Pauses until a human approves or rejects.',
      inputSchema: z.object({
        request: z.string().describe('Clear description of what you want approval for'),
        context: z.string().optional().describe('Additional context to help the human decide'),
      }),
      execute: async ({ request, context }) => {
        const fullRequest = context ? `${request}\n\nContext: ${context}` : request;
        const req = manager.createRequest(fullRequest, { timestamp: Date.now() });
        const result = await req.result;
        return {
          id: req.id,
          request: fullRequest,
          approved: result.approved,
          reason: result.reason,
        };
      },
    }),
  };
}

// --- generate_tests ---

export interface TestGenDeps {
  workspaceRoot?: string;
}

const toolSpecArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  inputSchema: fc.dictionary(fc.string(), fc.jsonValue()),
});

const connectionConfigArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  enabled: fc.boolean(),
  type: fc.oneof(
    fc.constant('cli'),
    fc.constant('irc'),
    fc.constant('ws'),
    fc.constant('http'),
    fc.constant('mcp')
  ),
  config: fc.dictionary(fc.string(), fc.jsonValue()),
  authSecret: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
});

const agentOptionsArbitrary = fc.record({
  nar: fc.option(fc.anything(), { nil: undefined }),
  lmService: fc.option(fc.anything(), { nil: undefined }),
  episodicMemory: fc.option(fc.anything(), { nil: undefined }),
  systemInstructions: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
  context: fc.option(
    fc.record({
      attention: fc.oneof(fc.boolean(), fc.array(fc.string())),
      beliefs: fc.oneof(fc.boolean(), fc.array(fc.string())),
      goals: fc.oneof(fc.boolean(), fc.array(fc.string())),
      questions: fc.oneof(fc.boolean(), fc.array(fc.string())),
      concepts: fc.oneof(fc.boolean(), fc.array(fc.string())),
      maxItems: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
      recency: fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
    }),
    { nil: undefined }
  ),
  maxLoops: fc.nat({ max: 50 }),
  logger: fc.option(fc.anything(), { nil: undefined }),
  persistKnowledge: fc.boolean(),
  knowledgePath: fc.string({ minLength: 1, maxLength: 200 }),
  workspaceRoot: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  externalTools: fc.option(fc.anything(), { nil: undefined }),
  approvalManager: fc.option(fc.anything(), { nil: undefined }),
  autonomyEngine: fc.option(fc.anything(), { nil: undefined }),
  reasoningIntervalMs: fc.option(fc.nat({ max: 3600000 }), { nil: undefined }),
  sessionHistoryLimit: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
  rateLimitPerMinute: fc.option(fc.nat({ max: 1000 }), { nil: undefined }),
  enableNlTranslation: fc.boolean(),
  enableNarseseHumanization: fc.boolean(),
});

const arbitraries: Record<string, fc.Arbitrary<unknown>> = {
  ToolSpec: toolSpecArbitrary,
  ConnectionConfig: connectionConfigArbitrary,
  AgentOptions: agentOptionsArbitrary,
};

function generateTestContent(schemaName: string, samples: unknown[]): string {
  const lines = [
    '// @generated by generate-tests tool',
    `// Schema: ${schemaName}`,
    `// Generated at: ${new Date().toISOString()}`,
    '',
    `import { describe, it, expect } from 'vitest';`,
    `import { ${schemaName}Schema } from '@senars/nar/tools/schemas';`,
    '',
    `describe('${schemaName} property tests', () => {`,
  ];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const sampleStr = JSON.stringify(sample, null, 2);
    lines.push(`  it('sample ${i + 1}', () => {`);
    lines.push(`    const input = ${sampleStr};`);
    lines.push(`    const result = ${schemaName}Schema.safeParse(input);`);
    lines.push(`    expect(result.success).toBe(true);`);
    lines.push(`  });`);

// Also test with an invalid mutation (wrong type for a known field)
    if (typeof sample === 'object' && sample !== null) {
      const mutated = { ...(sample as Record<string, unknown>) };
      // Add type violations based on schema
      if (schemaName === 'ToolSpec') {
        mutated.name = 123; // should be string
      } else if (schemaName === 'ConnectionConfig') {
        mutated.id = 123; // should be string
      } else if (schemaName === 'AgentOptions') {
        mutated.maxLoops = 'not a number'; // should be number
      }
      const mutatedStr = JSON.stringify(mutated, null, 2);
      lines.push(`  it('mutated sample ${i + 1} should fail (wrong type)', () => {`);
      lines.push(`    const input = ${mutatedStr};`);
      lines.push(`    const result = ${schemaName}Schema.safeParse(input);`);
      lines.push(`    expect(result.success).toBe(false);`);
      lines.push(`  });`);
    }
  }

  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

export function createTestGenTools(deps: TestGenDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const generatedDir = resolve(workspaceRoot, 'tests/generated');

  return {
    generate_tests: tool({
      description:
        'Generate property-based tests from Zod schemas using fast-check. Creates test files in tests/generated/.',
      inputSchema: z.object({
        schemaName: z
          .enum(['ToolSpec', 'ConnectionConfig', 'AgentOptions'])
          .describe('Name of the schema to generate tests for'),
        sampleCount: z.number().int().min(1).max(100).optional().default(10).describe('Number of test samples to generate'),
        outputPath: z.string().optional().describe('Custom output path (relative to tests/generated/)'),
      }),
      execute: async ({ schemaName, sampleCount = 10, outputPath }) => {
        const arbitrary = arbitraries[schemaName];
        if (!arbitrary) {
          return { error: `Unknown schema: ${schemaName}`, generated: 0 };
        }

        try {
          const samples = fc.sample(arbitrary, sampleCount);

          const testContent = generateTestContent(schemaName, samples);

          await mkdir(generatedDir, { recursive: true });

          const fileName = outputPath || `${schemaName.toLowerCase()}.test.ts`;
          const filePath = resolve(generatedDir, fileName);
          await writeFile(filePath, testContent, 'utf-8');

          return {
            success: true,
            schema: schemaName,
            samplesGenerated: samples.length,
            outputFile: filePath,
            relativePath: `tests/generated/${fileName}`,
          };
        } catch (error) {
          return { error: String(error), generated: 0 };
        }
      },
    }),
  };
}