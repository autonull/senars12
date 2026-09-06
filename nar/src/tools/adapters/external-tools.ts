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
import { NLUnderstandingService } from '../../nl/understanding.js';
import type { SeNARSRegistry } from '../../lm';
import { createLogger } from '../../logger';

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
  }
}

// --- coverage_concepts ---

export interface CoverageConceptDeps {
  workspaceRoot?: string;
  memory?: any; // NAR Memory instance
  threshold?: number; // Coverage threshold (default 80%)
}

interface FileCoverage {
  path: string;
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

function parseCoverageMap(output: string): FileCoverage[] {
  try {
    const lines = output.trim().split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.trim().startsWith('{')) {
        jsonStart = i;
        break;
      }
    }
    if (jsonStart === -1) return [];
    const jsonStr = lines.slice(jsonStart).join('\n');
    const data = JSON.parse(jsonStr);
    
    const results: FileCoverage[] = [];
    if (data.coverageMap) {
      for (const [filePath, fileCoverage] of Object.entries(data.coverageMap)) {
        const fc = fileCoverage as any;
        
        let totalLines = 0;
        let coveredLines = 0;
        let totalStatements = 0;
        let coveredStatements = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalBranches = 0;
        let coveredBranches = 0;
        
        if (fc.l) {
          for (const [, count] of Object.entries(fc.l)) {
            totalLines++;
            if ((count as number) > 0) coveredLines++;
          }
        }
        if (fc.s) {
          for (const [, count] of Object.entries(fc.s)) {
            totalStatements++;
            if ((count as number) > 0) coveredStatements++;
          }
        }
        if (fc.f) {
          for (const [, count] of Object.entries(fc.f)) {
            totalFunctions++;
            if ((count as number) > 0) coveredFunctions++;
          }
        }
        if (fc.b) {
          for (const [, count] of Object.entries(fc.b)) {
            totalBranches++;
            if ((count as number) > 0) coveredBranches++;
          }
        }
        
        const linesTotal = totalLines > 0 ? totalLines : totalStatements;
        const linesCovered = totalLines > 0 ? coveredLines : coveredStatements;
        
        results.push({
          path: filePath,
          lines: { total: linesTotal, covered: linesCovered, pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0 },
          statements: { total: totalStatements, covered: coveredStatements, pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0 },
          functions: { total: totalFunctions, covered: coveredFunctions, pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0 },
          branches: { total: totalBranches, covered: coveredBranches, pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0 },
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function createCoverageConceptTools(deps: CoverageConceptDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const outputFile = resolve(workspaceRoot, '.vitest/json/output.json');
  const threshold = deps.threshold ?? 80;

  return {
    coverage_concepts: tool({
      description:
        'Run tests with coverage and inject low-coverage files as high-priority concepts into NAR memory. Files with coverage < threshold get priority = 1 - coverage.',
      inputSchema: z.object({
        testPath: z.string().optional().describe('Specific test file or directory to run'),
        threshold: z.number().min(0).max(100).optional().default(threshold).describe('Coverage threshold (files below get concepts)'),
        injectEpisodes: z.boolean().optional().default(true).describe('Inject coverage episodes'),
      }),
      execute: async ({ testPath, threshold: userThreshold, injectEpisodes = true }) => {
        const effectiveThreshold = userThreshold ?? threshold;
        
        // Run tests with coverage
        const args = ['run', '--reporter=json', '--coverage'];
        if (testPath) args.push(testPath);

        return new Promise((resolve) => {
          const child = spawn('pnpm', ['vitest', ...args], {
            cwd: workspaceRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stderr = '';

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', async (exitCode) => {
            // Read and parse coverage
            let fileCoverages: FileCoverage[] = [];
            try {
              const { readFile } = await import('node:fs/promises');
              const outputContent = await readFile(outputFile, 'utf-8');
              fileCoverages = parseCoverageMap(outputContent);
            } catch {
              resolve({
                success: false,
                error: 'Failed to read coverage output',
                stderr: stderr.slice(0, 1000),
              });
              return;
            }

            if (fileCoverages.length === 0) {
              resolve({
                success: true,
                message: 'No coverage data found',
                conceptsInjected: 0,
              });
              return;
            }

            // Filter files below threshold
            const lowCoverageFiles = fileCoverages.filter(f => f.lines.pct < effectiveThreshold);
            
            let conceptsInjected = 0;
            const injectedConcepts: string[] = [];

            // Inject concepts into NAR memory if available
            if (deps.memory && lowCoverageFiles.length > 0) {
              try {
                // Import NAR types dynamically to avoid circular deps
                // @ts-ignore - dynamic import resolution
                const { TermBuilder, atom } = await import('../terms/index.js');
                
                for (const fc of lowCoverageFiles) {
                  // Create a term representing the file
                  const fileName = fc.path.split('/').pop()?.replace(/\.ts$/, '') || 'unknown';
                  const term = TermBuilder.atom(`coverage_${fileName}`);
                  
                  // Get or create concept
                  let concept = deps.memory.getConcept(term);
                  if (!concept) {
                    concept = deps.memory.addConcept(term);
                  }
                  
                  // Set priority based on coverage gap: priority = 1 - (coverage / 100)
                  // So 0% coverage = priority 1.0, 50% coverage = priority 0.5, 79% coverage = priority 0.21
                  const priority = 1 - (fc.lines.pct / 100);
                  concept.priority = Math.max(0.01, priority);
                  
                  // Add a belief about the coverage
                  // @ts-ignore - dynamic import resolution
                  const { Truth } = await import('../terms/truth.js');
                  const beliefTruth = Truth.create(
                    fc.lines.pct / 100,  // frequency = coverage percentage
                    0.9  // high confidence
                  );
                  
                  deps.memory.addTask(
                    term,
                    'belief',
                    beliefTruth
                  );
                  
                  // Add a goal to improve coverage
                  const goalTruth = Truth.create(0.5, 0.8);
                  deps.memory.addTask(
                    term,
                    'goal',
                    goalTruth
                  );
                  
                  conceptsInjected++;
                  injectedConcepts.push(`${fileName}: ${fc.lines.pct.toFixed(1)}% -> priority ${priority.toFixed(2)}`);
                }
              } catch (error) {
                console.warn('Failed to inject coverage concepts:', error);
              }
            }

            // Inject episodes if requested
            if (injectEpisodes && deps.memory) {
              try {
                // We'd need episodicMemory for this, skip for now
              } catch (error) {
                console.warn('Failed to inject coverage episodes:', error);
              }
            }

            resolve({
              success: true,
              totalFiles: fileCoverages.length,
              lowCoverageFiles: lowCoverageFiles.length,
              conceptsInjected,
              threshold: effectiveThreshold,
              injectedConcepts,
            });
          });

          child.on('error', (error) => {
            resolve({
              success: false,
              error: String(error),
            });
          });
        });
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

// --- run_tests ---

export interface TestRunnerDeps {
  workspaceRoot?: string;
  episodicMemory?: any;
  rlfpLearner?: any;
}

interface VitestResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: Array<{
    name: string;
    state: 'pass' | 'fail' | 'skip';
    duration: number;
    errors?: string[];
  }>;
  coverage?: {
    lines: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
  };
}

function parseVitestJsonOutput(output: string): VitestResult | null {
  try {
    // Find the JSON part (vitest outputs JSON on stdout, but may have other messages)
    const lines = output.trim().split('\n');
    // Look for the line that starts with { (JSON object)
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.trim().startsWith('{')) {
        jsonStart = i;
        break;
      }
    }
    if (jsonStart === -1) return null;
    const jsonStr = lines.slice(jsonStart).join('\n');
    const data = JSON.parse(jsonStr);
    
    // Calculate duration from test results
    let duration = 0;
    if (data.testResults) {
      for (const suite of data.testResults) {
        duration += (suite.endTime ?? 0) - (suite.startTime ?? 0);
      }
    }
    
    // Parse coverage from coverageMap
    let coverage: VitestResult['coverage'] = undefined;
    if (data.coverageMap) {
      let totalLines = 0;
      let coveredLines = 0;
      let totalStatements = 0;
      let coveredStatements = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      
      for (const file of Object.values(data.coverageMap)) {
        const fileCoverage = file as any;
        // Lines (l) - may not exist in all formats
        if (fileCoverage.l) {
          for (const [, count] of Object.entries(fileCoverage.l)) {
            totalLines++;
            if ((count as number) > 0) coveredLines++;
          }
        }
        // Statements (s)
        if (fileCoverage.s) {
          for (const [, count] of Object.entries(fileCoverage.s)) {
            totalStatements++;
            if ((count as number) > 0) coveredStatements++;
          }
        }
        // Functions (f)
        if (fileCoverage.f) {
          for (const [, count] of Object.entries(fileCoverage.f)) {
            totalFunctions++;
            if ((count as number) > 0) coveredFunctions++;
          }
        }
        // Branches (b)
        if (fileCoverage.b) {
          for (const [, count] of Object.entries(fileCoverage.b)) {
            totalBranches++;
            if ((count as number) > 0) coveredBranches++;
          }
        }
      }
      
      // Use statements as lines if lines not available
      const linesTotal = totalLines > 0 ? totalLines : totalStatements;
      const linesCovered = totalLines > 0 ? coveredLines : coveredStatements;
      
      coverage = {
        lines: { total: linesTotal, covered: linesCovered, pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0 },
        statements: { total: totalStatements, covered: coveredStatements, pct: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0 },
        functions: { total: totalFunctions, covered: coveredFunctions, pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0 },
        branches: { total: totalBranches, covered: coveredBranches, pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0 },
      };
    }
    
    return {
      success: data.success,
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      total: data.numTotalTests ?? 0,
      duration,
      tests: data.testResults?.flatMap((suite: any) => 
        suite.assertionResults?.map((t: any) => ({
          name: t.fullName,
          state: t.status === 'passed' ? 'pass' : t.status === 'failed' ? 'fail' : 'skip',
          duration: t.duration,
          errors: t.failureMessages,
        })) ?? []
      ) ?? [],
      coverage,
    };
  } catch {
    return null;
  }
}

export function createTestRunnerTools(deps: TestRunnerDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();
  const outputFile = resolve(workspaceRoot, '.vitest/json/output.json');

  return {
    run_tests: tool({
      description:
        'Run vitest tests in background and inject results into episodic memory. Returns test metrics for RLFP reward calculation.',
      inputSchema: z.object({
        testPath: z.string().optional().describe('Specific test file or directory to run'),
        includeCoverage: z.boolean().optional().default(false).describe('Include coverage data'),
        injectEpisodes: z.boolean().optional().default(true).describe('Inject test results as episodes'),
      }),
      execute: async ({ testPath, includeCoverage = false, injectEpisodes = true }) => {
        const args = ['run', '--reporter=json'];
        if (includeCoverage) args.push('--coverage');
        if (testPath) args.push(testPath);

        return new Promise((resolve) => {
          const child = spawn('pnpm', ['vitest', ...args], {
            cwd: workspaceRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stderr = '';

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', async (exitCode) => {
            // Read the JSON output file
            let result: VitestResult | null = null;
            try {
              const { readFile } = await import('node:fs/promises');
              const outputContent = await readFile(outputFile, 'utf-8');
              result = parseVitestJsonOutput(outputContent);
            } catch {
              // File doesn't exist or can't be read
            }
            
            if (!result) {
              resolve({
                success: false,
                error: 'Failed to parse vitest output',
                stderr: stderr.slice(0, 1000),
              });
              return;
            }

            // Inject episodes if requested
            if (injectEpisodes && deps.episodicMemory) {
              try {
                const timestamp = Date.now();
                
                // Inject overall test result
                await deps.episodicMemory.log(
                  result.success ? 'test_passed' : 'test_failed',
                  `Test suite ${result.success ? 'passed' : 'failed'}: ${result.passed}/${result.total} tests`,
                  {
                    type: 'test_suite_result',
                    passed: result.passed,
                    failed: result.failed,
                    total: result.total,
                    duration: result.duration,
                    coverage: result.coverage,
                    exitCode,
                  }
                );

                // Inject individual test results
                for (const test of result.tests) {
                  await deps.episodicMemory.log(
                    test.state === 'pass' ? 'test_passed' : 'test_failed',
                    `Test ${test.name} ${test.state}`,
                    {
                      type: 'test_result',
                      testName: test.name,
                      state: test.state,
                      duration: test.duration,
                      errors: test.errors,
                    }
                  );

                  // If test failed, inject a goal to fix it
                  if (test.state === 'fail' && test.errors) {
                    await deps.episodicMemory.log(
                      'goal',
                      `(^fixTest("${test.name}"))!`,
                      {
                        type: 'fix_test_goal',
                        testName: test.name,
                        errors: test.errors,
                      }
                    );
                  }
                }

                // Inject coverage info if available
                if (result.coverage && includeCoverage) {
                  await deps.episodicMemory.log(
                    'test_coverage',
                    `Coverage: lines ${result.coverage.lines.pct.toFixed(1)}%, statements ${result.coverage.statements.pct.toFixed(1)}%`,
                    {
                      type: 'coverage_report',
                      coverage: result.coverage,
                    }
                  );
                }
              } catch (error) {
                console.warn('Failed to inject test episodes:', error);
              }
            }

            // Calculate RLFP reward if learner available
            let reward = 0;
            if (deps.rlfpLearner && result) {
              const coverageDelta = result.coverage 
                ? (result.coverage.lines.pct / 100) - 0.5  // baseline 50%
                : 0;
              reward = deps.rlfpLearner.calculateReward({
                testPassRate: result.total > 0 ? result.passed / result.total : 0,
                avgTestDuration: result.tests.length > 0 
                  ? result.tests.reduce((sum, t) => sum + t.duration, 0) / result.tests.length 
                  : 0,
                coverageDelta,
                memoryOverage: 0,
                cpuThrottleTime: 0,
              });
            }

            resolve({
              success: result.success,
              passed: result.passed,
              failed: result.failed,
              total: result.total,
              duration: result.duration,
              coverage: result.coverage,
              reward,
              episodesInjected: injectEpisodes && !!deps.episodicMemory,
            });
          });

          child.on('error', (error) => {
            resolve({
              success: false,
              error: String(error),
            });
          });
        });
      },
    }),
  };
}

// --- generate_scenarios ---

const scenarioLogger = createLogger({ scope: 'ScenarioGen' });

export interface ScenarioInjectEvent {
  type: 'belief_stream' | 'question' | 'resource_pressure' | 'goal';
  pattern?: string;
  interval?: number;
  maxDerivationsPerStep?: number;
  narsese?: string;
  truth?: { f: number; c: number };
  priority?: number;
}

export interface ScenarioSuccessCriteria {
  no_crash?: boolean;
  contradiction_detected_within?: number;
  response_latency_p95?: number;
  min_derivations?: number;
  specific_belief_derived?: string;
}

export interface ScenarioSpec {
  name: string;
  description: string;
  duration_steps: number;
  inject: ScenarioInjectEvent[];
  success_criteria: ScenarioSuccessCriteria;
  metadata: {
    seed: string;
    generated_at: string;
    profile: string;
  };
}

export interface ScenarioResult {
  success: boolean;
  scenario_name: string;
  steps_executed: number;
  duration_ms: number;
  criteria_results: Record<string, boolean | number>;
  cognitive_events: number;
  contradictions_detected: number;
  derived_beliefs: string[];
  error?: string;
}

export interface ScenarioRunnerDeps {
  workspaceRoot?: string;
  nar?: any; // NAR instance
  episodicMemory?: any;
  rlfpLearner?: any;
  registry?: SeNARSRegistry;
}

interface ScenarioValidator {
  name: string;
  validate(result: ScenarioResult, spec: ScenarioSpec): { passed: boolean; score: number; details: string };
}

const validators: ScenarioValidator[] = [
  {
    name: 'no_crash',
    validate(result: ScenarioResult, _spec: ScenarioSpec) {
      return {
        passed: result.success,
        score: result.success ? 1.0 : 0.0,
        details: result.success ? 'No crash' : `Crashed: ${result.error}`,
      };
    },
  },
  {
    name: 'contradiction_detected',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.contradiction_detected_within ?? 10;
      const passed = result.contradictions_detected > 0 && result.steps_executed <= threshold;
      return {
        passed,
        score: passed ? 1.0 : 0.5,
        details: passed
          ? `Contradiction detected at step ${result.steps_executed}`
          : `No contradiction within ${threshold} steps`,
      };
    },
  },
  {
    name: 'latency_p95',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.response_latency_p95 ?? 100;
      const avgLatency = result.duration_ms / Math.max(result.steps_executed, 1);
      const passed = avgLatency <= threshold;
      return {
        passed,
        score: passed ? 1.0 : Math.max(0, 1 - avgLatency / (threshold * 2)),
        details: `Avg latency ${avgLatency.toFixed(1)}ms (threshold: ${threshold}ms)`,
      };
    },
  },
  {
    name: 'min_derivations',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const threshold = spec.success_criteria.min_derivations ?? 1;
      const passed = result.derived_beliefs.length >= threshold;
      return {
        passed,
        score: passed ? 1.0 : result.derived_beliefs.length / threshold,
        details: `${result.derived_beliefs.length}/${threshold} derivations`,
      };
    },
  },
  {
    name: 'specific_belief',
    validate(result: ScenarioResult, spec: ScenarioSpec) {
      const target = spec.success_criteria.specific_belief_derived;
      if (!target) return { passed: true, score: 1.0, details: 'No specific belief required' };
      const passed = result.derived_beliefs.some((b) => b.includes(target));
      return {
        passed,
        score: passed ? 1.0 : 0.0,
        details: passed ? `Derived ${target}` : `Missing ${target}`,
      };
    },
  },
];

function calculateScenarioReward(result: ScenarioResult, spec: ScenarioSpec): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const validator of validators) {
    const weight = spec.success_criteria[validator.name as keyof ScenarioSuccessCriteria] ? 1 : 0;
    if (weight === 0) continue;
    const validation = validator.validate(result, spec);
    totalScore += validation.score * weight;
    totalWeight += weight;
  }

  const baseReward = totalWeight > 0 ? totalScore / totalWeight : 0;
  const stepBonus = Math.min(1, result.steps_executed / spec.duration_steps) * 0.2;
  const eventBonus = Math.min(1, result.cognitive_events / 100) * 0.1;

  return Math.min(1, baseReward + stepBonus + eventBonus);
}

async function generateScenarioSpec(
  seed: string,
  profile: string,
  registry?: SeNARSRegistry
): Promise<ScenarioSpec> {
  if (!registry) {
    return generateTemplateScenario(seed, profile);
  }

  try {
    // @ts-ignore - TranslationCache interface mismatch
    const understanding = new NLUnderstandingService(registry, new Map(), { structuredOnly: true });
    const nlInput = `Generate a cognitive test scenario for SeNARS. Profile: ${profile}. Seed: "${seed}". 
    Output a JSON spec with: name, description, duration_steps, inject (array of events with type, pattern, interval), success_criteria.
    Events can be: belief_stream (pattern, interval), question (pattern, interval), resource_pressure (maxDerivationsPerStep), goal (narsese, priority).
    Success criteria: no_crash, contradiction_detected_within, response_latency_p95, min_derivations, specific_belief_derived.`;

    const taskBatch = await understanding.understand(nlInput);
    if (taskBatch && taskBatch.goals.length > 0) {
      const goalContent = taskBatch.goals[0]!.narsese;
      try {
        const parsed = JSON.parse(goalContent.replace(/^!/, '').trim());
        return {
          ...parsed,
          metadata: { seed, generated_at: new Date().toISOString(), profile },
        } as ScenarioSpec;
      } catch {
        scenarioLogger.warn('Failed to parse NL-generated scenario, using template');
      }
    }
  } catch (error: unknown) {
    scenarioLogger.warn('NL scenario generation failed, using template', { error: String(error) });
  }

  return generateTemplateScenario(seed, profile);
}

function generateTemplateScenario(seed: string, profile: string): ScenarioSpec {
  const profiles: Record<string, Partial<ScenarioSpec>> = {
    contradictory_sensors: {
      name: 'contradictory_sensors',
      description: 'Test handling of contradictory sensor inputs',
      duration_steps: 500,
      inject: [
        { type: 'belief_stream', pattern: '(sensor_A --> sensor_B). %0.9;0.9%', interval: 5 },
        { type: 'belief_stream', pattern: '(sensor_B --> sensor_A). %0.1;0.9%', interval: 5 },
        { type: 'question', pattern: '(sensor_A --> ?what)?', interval: 20 },
        { type: 'resource_pressure', maxDerivationsPerStep: 50 },
      ],
      success_criteria: {
        no_crash: true,
        contradiction_detected_within: 10,
        response_latency_p95: 100,
        min_derivations: 5,
      },
    },
    temporal_reasoning: {
      name: 'temporal_reasoning',
      description: 'Test event sequences with delayed evidence',
      duration_steps: 300,
      inject: [
        { type: 'belief_stream', pattern: '(event_A * event_B * event_C). %0.8;0.8%', interval: 10 },
        { type: 'question', pattern: '(event_A ==> event_C)?', interval: 30 },
        { type: 'resource_pressure', maxDerivationsPerStep: 100 },
      ],
      success_criteria: {
        no_crash: true,
        min_derivations: 3,
        specific_belief_derived: 'event_A ==> event_C',
      },
    },
    resource_pressure: {
      name: 'resource_pressure',
      description: 'Test AIKR graceful degradation under load',
      duration_steps: 400,
      inject: [
        { type: 'belief_stream', pattern: '(data --> pattern). %0.7;0.7%', interval: 2 },
        { type: 'resource_pressure', maxDerivationsPerStep: 20 },
        { type: 'question', pattern: '(data --> ?what)?', interval: 15 },
      ],
      success_criteria: {
        no_crash: true,
        response_latency_p95: 50,
        min_derivations: 10,
      },
    },
    belief_revision: {
      name: 'belief_revision',
      description: 'Test belief revision with incoming evidence streams',
      duration_steps: 350,
      inject: [
        { type: 'belief_stream', pattern: '(hypothesis --> confirmed). %0.6;0.6%', interval: 8 },
        { type: 'belief_stream', pattern: '(hypothesis --> refuted). %0.9;0.8%', interval: 20 },
        { type: 'question', pattern: '(hypothesis --> ?what)?', interval: 25 },
      ],
      success_criteria: {
        no_crash: true,
        contradiction_detected_within: 15,
        min_derivations: 5,
      },
    },
    cross_engine_sync: {
      name: 'cross_engine_sync',
      description: 'Test NAR-MeTTa coordination',
      duration_steps: 250,
      inject: [
        { type: 'belief_stream', pattern: '(nar_fact <-> metta_atom). %0.8;0.8%', interval: 10 },
        { type: 'goal', narsese: '(^sync(nar_fact, metta_atom))!', priority: 0.7 },
        { type: 'question', pattern: '(nar_fact <-> ?what)?', interval: 20 },
      ],
      success_criteria: {
        no_crash: true,
        min_derivations: 3,
        specific_belief_derived: 'nar_fact <-> metta_atom',
      },
    },
  };

  const profileSpec = profiles[profile] ?? profiles.contradictory_sensors!;

  return {
    name: profileSpec.name ?? profile,
    description: profileSpec.description ?? `Scenario for ${seed}`,
    duration_steps: profileSpec.duration_steps ?? 300,
    inject: profileSpec.inject ?? [],
    success_criteria: profileSpec.success_criteria ?? { no_crash: true },
    metadata: { seed, generated_at: new Date().toISOString(), profile },
  };
}

async function runScenario(nar: any, spec: ScenarioSpec): Promise<ScenarioResult> {
  const startTime = Date.now();
  let cognitiveEvents = 0;
  let contradictionsDetected = 0;
  const derivedBeliefs: string[] = [];

  const eventHandler = (event: any) => {
    cognitiveEvents++;
    if (event.type === 'conflict:detected' || event.type === 'belief.revised') {
      contradictionsDetected++;
    }
    if (event.type === 'belief.added' || event.type === 'belief.revised') {
      derivedBeliefs.push(event.payload.term);
    }
  };

  if (nar.getSystemEventBus) {
    nar.getSystemEventBus().on('*', eventHandler);
  }

  try {
    for (const injectEvent of spec.inject) {
      switch (injectEvent.type) {
        case 'belief_stream':
          if (injectEvent.pattern) {
            await nar.believe(injectEvent.pattern);
          }
          break;
        case 'question':
          if (injectEvent.pattern) {
            await nar.question(injectEvent.pattern);
          }
          break;
        case 'goal':
          if (injectEvent.narsese) {
            await nar.goal(injectEvent.narsese, injectEvent.priority ? { f: injectEvent.priority, c: 0.9 } : undefined);
          }
          break;
        case 'resource_pressure':
          if (injectEvent.maxDerivationsPerStep && nar.setConfig) {
            nar.setConfig({
              inference: { ...nar.getConfig().inference, maxDerivationsPerStep: injectEvent.maxDerivationsPerStep },
            });
          }
          break;
      }
    }

    const stepsToRun = spec.duration_steps;
    await nar.run(stepsToRun);

    const duration = Date.now() - startTime;

    return {
      success: true,
      scenario_name: spec.name,
      steps_executed: stepsToRun,
      duration_ms: duration,
      criteria_results: {},
      cognitive_events: cognitiveEvents,
      contradictions_detected: contradictionsDetected,
      derived_beliefs: derivedBeliefs,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      scenario_name: spec.name,
      steps_executed: 0,
      duration_ms: duration,
      criteria_results: {},
      cognitive_events: cognitiveEvents,
      contradictions_detected: contradictionsDetected,
      derived_beliefs: derivedBeliefs,
      error: String(error),
    };
  } finally {
    if (nar.getSystemEventBus) {
      nar.getSystemEventBus().off('*', eventHandler);
    }
  }
}

export interface ScenarioGenDeps {
  workspaceRoot?: string;
  nar?: any;
  episodicMemory?: any;
  rlfpLearner?: any;
  registry?: SeNARSRegistry;
}

export function createScenarioGenTools(deps: ScenarioGenDeps = {}) {
  const workspaceRoot = deps.workspaceRoot || process.cwd();

  return {
    generate_scenarios: tool({
      description:
        'Generate and execute cognitive scenarios using NL→Narsese→MeTTa pipeline. Tests integrated reasoning under realistic conditions.',
      inputSchema: z.object({
        seed: z.string().describe('High-level intent for scenario (e.g., "contradictory sensors under load")'),
        profile: z
          .enum([
            'contradictory_sensors',
            'temporal_reasoning',
            'resource_pressure',
            'belief_revision',
            'cross_engine_sync',
            'auto',
          ])
          .optional()
          .default('auto')
          .describe('Scenario profile/template to use'),
        count: z.number().int().min(1).max(20).optional().default(1).describe('Number of scenarios to generate and run'),
        injectEpisodes: z.boolean().optional().default(true).describe('Inject results into episodic memory'),
      }),
      execute: async ({ seed, profile, count = 1, injectEpisodes = true }) => {
        const results: ScenarioResult[] = [];
        const specs: ScenarioSpec[] = [];

        for (let i = 0; i < count; i++) {
          const scenarioSeed = count > 1 ? `${seed} (${i + 1}/${count})` : seed;
          const selectedProfile = profile === 'auto' ? inferProfile(scenarioSeed) : profile;

          const spec = await generateScenarioSpec(scenarioSeed, selectedProfile, deps.registry);
          specs.push(spec);

          if (deps.nar) {
            const result = await runScenario(deps.nar, spec);
            const reward = calculateScenarioReward(result, spec);

            result.criteria_results = validators.reduce((acc, v) => {
              const validation = v.validate(result, spec);
              acc[v.name] = validation.passed;
              return acc;
            }, {} as Record<string, boolean>);

            if (injectEpisodes && deps.episodicMemory) {
              await injectScenarioEpisodes(deps.episodicMemory, result, spec, reward);
            }

            if (deps.rlfpLearner) {
              deps.rlfpLearner.reward(reward, `scenario:${spec.name}`);
            }

            results.push(result);
          } else {
            results.push({
              success: true,
              scenario_name: spec.name,
              steps_executed: 0,
              duration_ms: 0,
              criteria_results: {},
              cognitive_events: 0,
              contradictions_detected: 0,
              derived_beliefs: [],
              error: 'NAR instance not provided - scenario spec generated only',
            });
          }
        }

        return {
          success: true,
          seed,
          profile,
          scenarios_generated: specs.length,
          scenarios_executed: results.filter((r) => r.steps_executed > 0).length,
          specs,
          results,
          summary: {
            passed: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            avg_reward:
              results.reduce((sum, r, idx) => sum + calculateScenarioReward(r, specs[idx]!), 0) /
              Math.max(results.length, 1),
          },
        };
      },
    }),
  };
}

function inferProfile(seed: string): string {
  const lower = seed.toLowerCase();
  if (lower.includes('contradict') || lower.includes('conflict') || lower.includes('sensor')) {
    return 'contradictory_sensors';
  }
  if (lower.includes('temporal') || lower.includes('sequence') || lower.includes('event')) {
    return 'temporal_reasoning';
  }
  if (lower.includes('load') || lower.includes('pressure') || lower.includes('overload') || lower.includes('resource')) {
    return 'resource_pressure';
  }
  if (lower.includes('revision') || lower.includes('belief') || lower.includes('evidence')) {
    return 'belief_revision';
  }
  if (lower.includes('cross') || lower.includes('sync') || lower.includes('metta') || lower.includes('engine')) {
    return 'cross_engine_sync';
  }
  return 'contradictory_sensors';
}

async function injectScenarioEpisodes(
  episodicMemory: any,
  result: ScenarioResult,
  spec: ScenarioSpec,
  reward: number
): Promise<void> {
  try {
    await episodicMemory.log(
      result.success ? 'scenario_passed' : 'scenario_failed',
      `Scenario ${spec.name} ${result.success ? 'passed' : 'failed'}`,
      {
        type: 'scenario_result',
        scenario: spec.name,
        profile: spec.metadata.profile,
        success: result.success,
        steps: result.steps_executed,
        duration_ms: result.duration_ms,
        contradictions: result.contradictions_detected,
        events: result.cognitive_events,
        derivations: result.derived_beliefs.length,
        reward,
        criteria: result.criteria_results,
      }
    );

    if (!result.success) {
      await episodicMemory.log(
        'goal',
        `(^fixScenario("${spec.name}"))!`,
        {
          type: 'fix_scenario_goal',
          scenario: spec.name,
          errors: [result.error ?? 'Unknown failure'],
        }
      );
    }
  } catch (error: unknown) {
    scenarioLogger.warn('Failed to inject scenario episodes', { error: String(error) });
  }
}