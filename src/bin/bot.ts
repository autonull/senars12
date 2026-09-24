#!/usr/bin/env tsx
/**
 * SeNARS Bot — unified interactive entry point (TODO21).
 *
 * CLI-only by default: no IRC/WS/HTTP/MCP unless ENABLE_*=true or started
 * at runtime via `.connect`. Replaces bot-ai.ts, repl.ts, status.ts,
 * doctor.ts, multi-agent.ts, tune.ts (`--status/--doctor/--tune/--arcade/
 * --multiagent` delegate to `src/bin/lib/*` runners).
 */

import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  AuthManager,
  bindAgentToConnection,
  type CLICommand,
  CLIConnection,
  CommandRegistry,
  connectionCommands,
  ConnectionManager,
  createAuthCommands,
  createConnectionConfigsFromEnv,
  HTTPConnection,
  IRCConnection,
  MCPConnection,
  WSConnection,
} from '@senars/io';
import type { Agent } from '@senars/nar/agent';
import { formatLMConfig, resolveLMConfig, resolveLMSettings } from '@senars/nar/lm';
import { computeEvidenceId } from '@senars/nar/lm/system-one';
import { LM_PROVIDER_NAMES } from '@senars/nar/lm/env-config.js';
import { createLogger } from '@senars/nar/logger';
import {
  configCommands,
  coreCommands,
  episodesCommands,
  lmCommands,
  memoryCommands,
  narCommands,
  rlfpCommands,
  selfCommands,
} from '@senars/nar/commands';
import { buildCommands } from '../cli/commands.js';
import { loadConfig } from '../config/index.js';
import { assertValidEnv } from '../utils/env-validate.js';
import { readAuthConfig, readIRCConfig } from './lib/env-config.js';
import { createAgentFromEnv, setupGracefulShutdown } from './lib/lifecycle.js';
import { runEntrypoint } from './lib/fatal-error.js';

assertValidEnv();

const logger = createLogger({ scope: 'bot' });
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const cmd = (
  name: string,
  description: string,
  execute: (args?: string) => string | Promise<string>
): CLICommand => ({ name, description, execute });

type Wired = Awaited<ReturnType<typeof createAgentFromEnv>>;

interface GroundednessState {
  enabled: boolean;
  threshold: number;
  gate: ((text: string) => Promise<boolean>) | undefined;
}

/** Min grade score for a conversation to be auto-captured into the distillation dataset. */
const DISTILL_CAPTURE_THRESHOLD = 0.7;

interface TraceState {
  enabled: boolean;
  sampleRate: number;
  grader: ((trace: any) => Promise<any>) | undefined;
  dataset?: { record: (label: unknown, embedding?: Float32Array) => void } | undefined;
  embeddingCache?: {
    write: (text: string) => Promise<unknown>;
    read: (pointer: unknown) => Float32Array | undefined;
  } | undefined;
}

/** Auto-capture a high-quality graded conversation into the distillation dataset. */
const captureDistillation = async (
  trace: TraceState,
  input: string,
  response: string,
  score: number
): Promise<void> => {
  const { dataset, embeddingCache } = trace;
  if (!dataset || !embeddingCache || !response.trim()) return;
  try {
    const evidenceId = computeEvidenceId(input, response);
    const pointer = await embeddingCache.write(response);
    const embedding = embeddingCache.read(pointer);
    dataset.record(
      {
        evidenceId,
        rubric: 'groundedness',
        axis: 'epistemic',
        label: 'accepted',
        score,
        source: 'conversation',
      },
      embedding
    );
  } catch {
    // Distillation capture is best-effort; never disrupt chat
  }
};

async function collectChat(
  agent: Agent,
  input: string,
  tier: 'quality' | 'fast' | 'structured',
  ground: GroundednessState,
  trace: TraceState
): Promise<void> {
  const ctl = new AbortController();
  const onSigint = () => ctl.abort();
  process.once('SIGINT', onSigint);
  try {
    let response = '';
    for await (const evt of agent.chat(input, { signal: ctl.signal, tier } as never)) {
      if (evt.kind === 'text-delta' && evt.text) {
        response += evt.text;
        if (ground.enabled && ground.gate) {
          const ok = await ground.gate(evt.text);
          if (ok) process.stdout.write(evt.text);
          else process.stdout.write('[filtered]');
        } else {
          process.stdout.write(evt.text);
        }
      } else if (evt.kind === 'tool-call') process.stdout.write(`\n[tool:${evt.toolName}]\n`);
      else if (evt.kind === 'error' || evt.kind === 'aborted') break;
    }
    // Trace grader sampling + distillation auto-capture from successful conversations
    if (trace.enabled && trace.grader && Math.random() < trace.sampleRate) {
      const toolCalls: Array<{ command: string; success: boolean }> = [];
      try {
        const grade = await trace.grader({ narration: response || input, toolCalls });
        const score = grade.groundedness?.abstained ? grade.contrastiveQuality : grade.groundedness?.score;
        if (score !== undefined && score >= DISTILL_CAPTURE_THRESHOLD) {
          await captureDistillation(trace, input, response, score);
        }
      } catch {
        // Ignore trace grading errors
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.stdout.write('\n');
  }
}

const setPath = (obj: Record<string, unknown>, path: string, value: unknown): boolean => {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i] ?? ''];
    if (typeof next !== 'object' || next === null) return false;
    cur = next as Record<string, unknown>;
  }
  cur[keys[keys.length - 1] ?? ''] = value;
  return true;
};

const coerce = (raw: string): unknown =>
  raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : Number.isNaN(Number(raw)) || raw.trim() === '' ? raw : Number(raw);

const gpuSummary = async (): Promise<string> => {
  try {
    const { getLlamaGpuTypes } = await import('node-llama-cpp');
    const types = await getLlamaGpuTypes('supported');
    const avail = (types as Array<{ name?: string; available?: boolean }>)
      .filter((t) => t.available)
      .map((t) => t.name ?? String(t));
    return avail.length ? avail.join(',') : 'cpu';
  } catch {
    return 'unknown';
  }
};

function buildExtraCommands(w: Wired, cm: ConnectionManager, auth: AuthManager, ground: GroundednessState, trace: TraceState, conversationGame: { focus: any; game: any } | null, routing: { auto: boolean; policy: 'conservative' | 'balanced' | 'aggressive' }, provisional: { enabled: boolean }): CLICommand[] {
  const { agent, nar, sessionManager, episodicMemory, lmService } = w;
  // loadConfig() returns a deeply frozen object — clone for runtime mutation.
  let appConfig = structuredClone(w.appConfig);
  const profile = appConfig.profile;
  const secretIds = new Set<string>();
  let webuiHandle: { close?: () => Promise<void> } | null = null;
  let tier: 'quality' | 'fast' | 'structured' = profile.narrateTier;

  const attach = async (cfg: {
    id: string;
    type: string;
    config: Record<string, unknown>;
  }): Promise<string> => {
    const conn = await cm.addConnection({ ...cfg, enabled: true }, { emit: () => undefined, logger });
    const registry = new CommandRegistry();
    for (const c of [
      ...coreCommands, ...narCommands, ...memoryCommands, ...episodesCommands,
      ...configCommands, ...lmCommands, ...rlfpCommands, ...selfCommands,
      ...connectionCommands, ...createAuthCommands(auth),
    ]) registry.register(c);
    bindAgentToConnection(agent, conn as never, {
      auth, commandRegistry: registry, sessionManager, episodicMemory, manager: cm,
    } as never);
    return `Connected ${cfg.type} as ${cfg.id}`;
  };

  return [
    cmd('help', 'Show all commands (categorized)', () =>
      `SeNARS Bot — CLI-first (.help, .quit, or just chat)\n\nConnection:\n  .connect irc [server] [port] [nick] [#ch1,#ch2] [--tls|--no-tls] [--password p]\n  .connect ws [port] [--greeting msg]\n  .connect http [port] [--api-key k] [--cors]\n  .connect mcp [stdio|http|sse] [--approval] [--api-key k] [--rate-limit n]\n  .disconnect <id> | .connections [id]\nCore: .stats .beliefs .concepts .attention .episodes .know .recall .sessions .session .throttle .tier .status .clear\nProfile: .profile [field value] | Skills: .skills .skill-enable .skill-disable .skill-add .skill-remove .skill-edit | Memory: .consolidate .memory-stats .memory-export .memory-import .memory-clear\nLM: .lm-config .lm-provider .lm-model .lm-rules .lm-rule-enable .lm-rule-disable .routing .routing-set .routing-offline .circuit-breakers .circuit-reset | SystemOne: .systemone .manifold .calibrate .distill .selftune\nDiag: .doctor .health .benchmarks .routing-log .spend .gates | .webui [port]|stop | .arcade | .multiagent | .config-show .config-set .config-save .config-reload .config-reset | .auth-list .auth-add .auth-remove`
    ),
    cmd('connect', 'Start a connection: irc|ws|http|mcp', async (args = '') => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const kind = parts[0]?.toLowerCase();
      const rest = parts.slice(1);
      const flag = (n: string): string | undefined => {
        const i = rest.findIndex((p) => p === `--${n}`);
        return i >= 0 ? (rest[i + 1] ?? '') : undefined;
      };
      const has = (n: string): boolean => rest.includes(`--${n}`);
      const pos = rest.filter((p) => !p.startsWith('--'));
      try {
        if (kind === 'irc') {
          const [server = 'irc.libera.chat', port = '6697', nick = 'senars-bot', chans = '#senars'] = pos;
          return await attach({ id: `irc-${Date.now()}`, type: 'irc', config: {
            name: 'IRC', server, port: Number(port), nick,
            channels: (chans ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            tls: has('no-tls') ? false : true, ...(flag('password') ? { password: flag('password') } : {}),
          } });
        }
        if (kind === 'ws' || kind === 'websocket')
          return await attach({ id: `ws-${Date.now()}`, type: 'websocket', config: {
            name: 'WS', port: Number(pos[0] ?? '8765'), ...(flag('greeting') ? { greeting: flag('greeting') } : {}),
          } });
        if (kind === 'http')
          return await attach({ id: `http-${Date.now()}`, type: 'http', config: {
            name: 'HTTP', port: Number(pos[0] ?? '3000'),
            ...(flag('api-key') ? { apiKey: flag('api-key') } : {}), cors: has('cors'),
          } });
        if (kind === 'mcp')
          return await attach({ id: `mcp-${Date.now()}`, type: 'mcp', config: {
            name: 'MCP', transport: pos[0] ?? 'stdio',
            ...(has('approval') ? { approval: true } : {}),
            ...(flag('api-key') ? { apiKey: flag('api-key') } : {}),
            ...(flag('rate-limit') ? { rateLimit: Number(flag('rate-limit')) } : {}),
          } });
        return 'Usage: .connect irc|ws|http|mcp [...]';
      } catch (e) { return `connect failed: ${errMsg(e)}`; }
    }),
    cmd('disconnect', 'Disconnect and remove a connection', async (args = '') => {
      const key = args.trim().split(/\s+/)[0]?.toLowerCase();
      if (!key) return 'Usage: .disconnect <connection-id|irc|ws|http|mcp>';
      try {
        const direct = cm.getConnection(args.trim().split(/\s+/)[0] ?? '');
        const id = direct?.id
          ?? [...cm.getConnections()].find(([, c]) => c.type === key || c.type.replace('websocket', 'ws') === key)?.[0];
        if (!id) return `Unknown connection: ${key}`;
        await cm.removeConnection(id);
        return `Disconnected ${id}`;
      } catch (e) { return `disconnect failed: ${errMsg(e)}`; }
    }),
    cmd('connections', 'List connections or show one in detail', (args = '') => {
      const id = args.trim().split(/\s+/)[0];
      if (id) {
        const c = cm.getConnection(id);
        if (!c) return `Unknown connection: ${id}`;
        const s = c.getStatus();
        return `${c.id} (${c.type}): ${s.state} msgs=${s.messageCount} errs=${s.errorCount}`;
      }
      const all = cm.getConnections();
      if (all.size === 0) return 'No active connections (CLI-only mode)';
      return [...all].map(([cid, c]) => `  ${cid} (${c.type}): ${c.getStatus().state}`).join('\n');
    }),
    cmd('profile', 'Show or set profile fields', (args = '') => {
      const [field, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (!field) return `name=${profile.name} personality=${profile.personality?.slice(0, 80)} tier=${tier} join=${profile.joinMessage?.slice(0, 80) ?? '—'}`;
      if (field === 'tier') return 'Use .tier quality|fast|structured to switch chat tier';
      if (field in profile && rest.length) { (profile as Record<string, unknown>)[field] = rest.join(' '); return `profile.${field} updated`; }
      return 'Usage: .profile [name|personality|joinmsg|tier <value>]';
    }),
    cmd('skills', 'List skills', () => {
      const skills = (appConfig.bot.skills ?? []) as Array<{ id?: string; name?: string; enabled?: boolean; description?: string }>;
      return skills.length
        ? skills.map((s) => `  ${(s.id ?? s.name ?? '?')} [${s.enabled === false ? 'off' : 'on'}] ${s.description ?? ''}`).join('\n')
        : '(no skills configured)';
    }),
    cmd('skill-enable', 'Enable a skill', (args = '') => {
      const id = args.trim();
      const s = ((appConfig.bot.skills ?? []) as Array<Record<string, unknown>>).find((x) => x.id === id || x.name === id);
      if (!s) return `Unknown skill: ${id}`;
      s.enabled = true; return `Enabled ${id} (persist with .config-save)`;
    }),
    cmd('skill-disable', 'Disable a skill', (args = '') => {
      const id = args.trim();
      const s = ((appConfig.bot.skills ?? []) as Array<Record<string, unknown>>).find((x) => x.id === id || x.name === id);
      if (!s) return `Unknown skill: ${id}`;
      s.enabled = false; return `Disabled ${id} (persist with .config-save)`;
    }),
    cmd('skill-add', 'Add a skill: <id> <description> <instructions>', (args = '') => {
      const [id, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (!id || rest.length < 2) return 'Usage: .skill-add <id> <description> <instructions>';
      const skills = (appConfig.bot.skills ?? []) as Array<Record<string, unknown>>;
      if (skills.some((s) => s.id === id)) return `Skill exists: ${id}`;
      skills.push({ id, description: rest.slice(0, -1).join(' '), instructions: rest[rest.length - 1], enabled: true });
      return `Added ${id} (persist with .config-save)`;
    }),
    cmd('skill-remove', 'Remove a skill', (args = '') => {
      const id = args.trim();
      const skills = (appConfig.bot.skills ?? []) as Array<Record<string, unknown>>;
      const i = skills.findIndex((s) => s.id === id || s.name === id);
      if (i < 0) return `Unknown skill: ${id}`;
      skills.splice(i, 1); return `Removed ${id} (persist with .config-save)`;
    }),
    cmd('skill-edit', 'Edit a skill field: <id> <field> <value>', (args = '') => {
      const [id, field, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      if (!id || !field || !rest.length) return 'Usage: .skill-edit <id> <description|instructions|enabled> <value>';
      const s = ((appConfig.bot.skills ?? []) as Array<Record<string, unknown>>).find((x) => x.id === id || x.name === id);
      if (!s) return `Unknown skill: ${id}`;
      if (!(field in s)) return `Unknown field: ${field}`;
      s[field] = field === 'enabled' ? rest[0] !== 'false' : rest.join(' ');
      return `Updated ${id}.${field} (persist with .config-save)`;
    }),
    cmd('consolidate', 'Run memory consolidation', async (args = '') => {
      const [limit, relevance, dedupe] = args.trim().split(/\s+/).filter(Boolean).map(Number);
      try {
        const r = await w.consolidateMemory({
          ...(Number.isFinite(limit) ? { limit } : {}),
          ...(Number.isFinite(relevance) ? { relevanceThreshold: relevance } : {}),
          ...(Number.isFinite(dedupe) ? { dedupeThreshold: dedupe } : {}),
        });
        return `Consolidated: promoted=${r.promoted} deduped=${r.deduped ?? 0} scanned=${r.scanned ?? 0}`;
      } catch (e) { return `consolidate failed: ${errMsg(e)}`; }
    }),
    cmd('memory-stats', 'Episodic memory stats', async () => {
      const eps = await episodicMemory.getEpisodes({ limit: 100000 });
      const byType = new Map<string, number>();
      for (const e of eps) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
      return `episodes=${eps.length} path=${episodicMemory.basePath}\n${[...byType].map(([t, n]) => `  ${t}: ${n}`).join('\n') || '  (empty)'}`;
    }),
    cmd('memory-clear', 'Clear episodic memory (requires --yes)', async (args = '') => {
      if (!args.includes('--yes')) return 'Destructive. Re-run as .memory-clear --yes to confirm';
      await episodicMemory.clear();
      return 'Episodic memory cleared';
    }),
    cmd('memory-export', 'Export episodes to JSONL', async (args = '') => {
      const path = args.trim() || '.cache/episodes-export.jsonl';
      const eps = await episodicMemory.getEpisodes({ limit: 100000 });
      await writeFile(path, eps.map((e) => JSON.stringify(e)).join('\n'));
      return `Exported ${eps.length} episodes to ${path}`;
    }),
    cmd('memory-import', 'Import episodes from JSONL', async (args = '') => {
      const path = args.trim();
      if (!path) return 'Usage: .memory-import <path>';
      try {
        const lines = (await readFile(path, 'utf-8')).split('\n').filter((l) => l.trim());
        let n = 0;
        for (const line of lines) {
          try {
            const e = JSON.parse(line) as { type?: string; content?: string; metadata?: Record<string, unknown> };
            if (typeof e.content === 'string') { await episodicMemory.log((e.type as never) ?? 'input', e.content, e.metadata ?? {}); n++; }
          } catch { /* skip malformed */ }
        }
        return `Imported ${n}/${lines.length} episodes`;
      } catch (e) { return `import failed: ${errMsg(e)}`; }
    }),
    cmd('lm-config', 'Show resolved LM config', async () => {
      const s = resolveLMSettings(appConfig.lm as never);
      const gpu = s.provider === 'llamacpp-embedded' ? ` gpu=${s.llamacppGpu ?? 'auto'} gpuDetail=${await gpuSummary()}` : '';
      return `${formatLMConfig(resolveLMConfig(appConfig.lm as never))}${gpu}\nfast=${s.fastModel ?? '—'} structured=${s.structuredModel ?? '—'} baseUrl=${s.baseUrl ?? '—'}`;
    }),
    cmd('lm-provider', 'Switch provider (takes effect on restart)', (args = '') => {
      const name = args.trim().toLowerCase();
      if (!name) return `provider=${resolveLMSettings().provider}`;
      if (!(LM_PROVIDER_NAMES as readonly string[]).includes(name)) return `Unknown provider: ${name} (${LM_PROVIDER_NAMES.join('|')})`;
      process.env.LM_PROVIDER = name;
      return `LM_PROVIDER=${name} (restart bot to apply)`;
    }),
    cmd('lm-model', 'Set model for tier: quality|fast|structured', (args = '') => {
      const [task, ...rest] = args.trim().split(/\s+/);
      const model = rest.join(' ');
      if (!task || !model) return 'Usage: .lm-model <quality|fast|structured> <model>';
      if (task === 'quality') process.env.LM_MODEL = model;
      else if (task === 'fast') process.env.LM_FAST_MODEL = model;
      else if (task === 'structured') process.env.LM_STRUCTURED_MODEL = model;
      else return 'Usage: .lm-model <quality|fast|structured> <model>';
      return `${task} model=${model} (restart bot to apply)`;
    }),
    cmd('lm-rules', 'List LM rules from config', () =>
      ((appConfig.bot.lmRules?.rules ?? []) as string[]).join(', ') || '(no lm rules configured)'
    ),
    cmd('lm-rule-enable', 'Enable an LM rule id', (args = '') => {
      const id = args.trim();
      if (!id) return 'Usage: .lm-rule-enable <id>';
      const rules = (appConfig.bot.lmRules?.rules ?? []) as string[];
      if (!rules.includes(id)) rules.push(id);
      return `Enabled ${id} (restart bot to register; persist with .config-save)`;
    }),
    cmd('lm-rule-disable', 'Disable an LM rule id', (args = '') => {
      const id = args.trim();
      if (!id) return 'Usage: .lm-rule-disable <id>';
      const rules = (appConfig.bot.lmRules?.rules ?? []) as string[];
      const i = rules.indexOf(id);
      if (i < 0) return `Not configured: ${id}`;
      rules.splice(i, 1);
      return `Disabled ${id} (restart bot to deregister; persist with .config-save)`;
    }),
    cmd('routing', 'Show routing matrix', async () => {
      try {
        const { getModelChain } = await import('@senars/nar/lm/providers.js');
        const cfg = resolveLMConfig();
        return (['quality', 'fast', 'structured'] as const).map((t) => `  ${t}: ${getModelChain(cfg.provider, t).join(' → ')}`).join('\n');
      } catch (e) { return `routing unavailable: ${errMsg(e)}`; }
    }),
    cmd('routing-set', 'Set routing candidates live: <model-id...>', async (args = '') => {
      const candidates = args.trim().split(/\s+/).filter(Boolean);
      if (!candidates.length) return 'Usage: .routing-set <model-id...>';
      try {
        const { getRouting, setRouting } = await import('@senars/nar/lm/providers.js');
        setRouting({ ...(getRouting() ?? {}), candidates });
        if (appConfig.routing) (appConfig.routing as Record<string, unknown>).candidates = candidates;
        return `candidates=${candidates.join(',')} (persist with .config-save)`;
      } catch (e) { return `routing-set failed: ${errMsg(e)}`; }
    }),
    cmd('routing-offline', 'Set offline failsafe ladder: <model-id...>', async (args = '') => {
      const ladder = args.trim().split(/\s+/).filter(Boolean);
      if (!ladder.length) return 'Usage: .routing-offline <model-id...>';
      try {
        const { getRouting, setRouting } = await import('@senars/nar/lm/providers.js');
        setRouting({ ...(getRouting() ?? {}), offlineLadder: ladder });
        if (appConfig.routing) (appConfig.routing as Record<string, unknown>).offlineLadder = ladder;
        return `offline ladder=${ladder.join(' → ')} (persist with .config-save)`;
      } catch (e) { return `routing-offline failed: ${errMsg(e)}`; }
    }),
    cmd('circuit-breakers', 'Show circuit breaker states', async () => {
      try {
        const { getCircuitBreaker, getEffectiveCircuitConfig } = await import('@senars/nar/lm/providers.js');
        const s = resolveLMSettings();
        return (['anthropic', 'openai', 'openai-compatible', 'llamacpp', 'llamacpp-embedded', 'transformers', 'mock'] as const)
          .map((p) => { try { const b = getCircuitBreaker(p as never); getEffectiveCircuitConfig(p as never, s as never); return `  ${p}: ${b.state} fails=${b.consecutiveFailures}`; } catch { return `  ${p}: n/a`; } })
          .join('\n');
      } catch (e) { return `circuit info unavailable: ${errMsg(e)}`; }
    }),
    cmd('circuit-reset', 'Reset circuit breaker(s): <provider>|all', async (args = '') => {
      const name = args.trim().toLowerCase();
      if (!name) return 'Usage: .circuit-reset <provider>|all';
      try {
        const { getCircuitBreaker, resetCircuitBreakers } = await import('@senars/nar/lm/providers.js');
        if (name === 'all') { resetCircuitBreakers(); return 'All circuit breakers reset'; }
        const b = getCircuitBreaker(name as never) as { reset?: () => void };
        if (typeof b.reset !== 'function') return `No resettable breaker: ${name}`;
        b.reset();
        return `Circuit breaker reset: ${name}`;
      } catch (e) { return `circuit-reset failed: ${errMsg(e)}`; }
    }),
    cmd('systemone', 'System One status / subcommands: heads|dispatcher|cortex|reflexes', (args = '') => {
      const on = nar.isSystemOneEnabled?.() ?? false;
      if (!on) return 'System One: disabled (enable via config systemOne.enabled + restart)';
      const sub = args.trim().toLowerCase();
      if (sub === 'heads') return formatSystemOneHeads(nar);
      if (sub === 'dispatcher') return formatSystemOneDispatcher(nar);
      if (sub === 'cortex') return formatSystemOneCortex(nar);
      if (sub === 'reflexes') return formatSystemOneReflexes(nar);
      return formatSystemOneStatus(nar, conversationGame);
    }),
    cmd('judge', 'Run manifold heads on a proposition: .judge <proposition> [--head <rubric>]', async (args = '') => {
      const manifold = nar.getSystemOneManifold?.();
      const embeddingCache = nar.getSystemOneEmbeddingCache?.();
      if (!manifold || !embeddingCache) return 'System One manifold not available';

      const parts = args.trim().split(/\s+/);
      const headFlag = parts.indexOf('--head');
      let headRubric: string | undefined;
      if (headFlag >= 0 && parts[headFlag + 1]) {
        headRubric = parts[headFlag + 1];
        parts.splice(headFlag, 2);
      }
      const proposition = parts.join(' ');
      if (!proposition) return 'Usage: .judge <proposition> [--head <rubric>]';

      const budget = { maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000, maxLMCalls: 5, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } };
      const pointer = await embeddingCache.write(proposition);
      const queries = headRubric
        ? [{ kind: 'evaluate' as const, instruction: `Evaluate ${headRubric}`, rubric: headRubric as any, axis: 'epistemic' as const }]
        : [
            { kind: 'evaluate' as const, instruction: 'Evaluate entailment', rubric: 'entailment' as any, axis: 'epistemic' as const },
            { kind: 'evaluate' as const, instruction: 'Evaluate groundedness', rubric: 'groundedness' as any, axis: 'epistemic' as const },
            { kind: 'evaluate' as const, instruction: 'Evaluate quality', rubric: 'plausibility' as any, axis: 'epistemic' as const },
            { kind: 'evaluate' as const, instruction: 'Evaluate safety', rubric: 'assertion' as any, axis: 'epistemic' as const },
          ];
      try {
        const results = await manifold.judgeBatch(pointer as any, queries, budget);
        return results.map((r) => {
          if (r.kind === 'evaluate') return `${r.axis}/${r.rubric}: score=${r.score.toFixed(3)} abstained=${r.abstained} latency=${r.latencyMs}ms`;
          return `${r.axis}/${r.rubric}: top=${r.top.option} p=${r.top.p.toFixed(3)} entropy=${r.entropy.toFixed(3)} latency=${r.latencyMs}ms`;
        }).join('\n');
      } catch (e) {
        return `judge failed: ${errMsg(e)}`;
      }
    }),
    cmd('route', 'Show dispatcher routing decision for a task: .route <task> [--verbose]', async (args = '') => {
      const dispatcher = nar.getSystemOneDispatcher?.();
      const embeddingCache = nar.getSystemOneEmbeddingCache?.();
      if (!dispatcher || !embeddingCache) return 'System One dispatcher not available';

      const parts = args.trim().split(/\s+/);
      const verbose = parts.includes('--verbose');
      const task = parts.filter((p) => p !== '--verbose').join(' ');
      if (!task) return 'Usage: .route <task> [--verbose]';

      const budget = { maxCycles: 100, maxDepth: 10, maxMemoryOps: 1000, maxLMCalls: 5, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } };
      const pointer = await embeddingCache.write(task);
      const queries = [
        { kind: 'classify' as const, instruction: 'Classify task type', space: ['question', 'belief', 'goal', 'tool'], axis: 'epistemic' as const, rubric: 'task_type' as any },
        { kind: 'evaluate' as const, instruction: 'Evaluate injection risk', rubric: 'injection' as any, axis: 'epistemic' as const },
        { kind: 'evaluate' as const, instruction: 'Evaluate ambiguity', rubric: 'ambiguity' as any, axis: 'epistemic' as const },
      ];
      try {
        const results = await dispatcher.judge(pointer as any, queries, budget);
        const lines = ['Routing decision for:', `  "${task}"`, ''];
        for (const r of results) {
          if (r.kind === 'classify') {
            lines.push(`  ${r.rubric}: ${r.top.option} (p=${r.top.p.toFixed(3)})${verbose ? ` entropy=${r.entropy.toFixed(3)} tier=${r.tier}` : ''}`);
          } else {
            lines.push(`  ${r.rubric}: score=${r.score.toFixed(3)} abstained=${r.abstained}${verbose ? ` tier=${r.tier} latency=${r.latencyMs}ms` : ''}`);
          }
        }
        // Show tier path
        const tier1Result = results.find((r) => r.tier === 1);
        const tier = tier1Result ? 'tier1 (manifold)' : 'tier0 (deterministic)';
        lines.push('', `Path: ${tier}`);
        return lines.join('\n');
      } catch (e) {
        return `route failed: ${errMsg(e)}`;
      }
    }),
    cmd('cortex', 'Cortex control: .cortex on|off|status|model <id>|grammar <narsese|json>', async (args = '') => {
      const dispatcher = nar.getSystemOneDispatcher?.() as any;
      if (!dispatcher) return 'System One dispatcher not available';
      const cortex = dispatcher.cortex;
      if (!cortex || cortex instanceof (await import('@senars/nar/lm/system-one/dispatcher.js')).then(m => m.StubCortex)) {
        return 'Cortex not available (System One cortex provider must be configured)';
      }
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (sub === 'status' || !sub) {
        const health = cortex.health?.();
        return `Cortex: ${health?.provider ?? 'unknown'} (breaker: ${health?.breakerOpen ? 'open' : 'closed'}) grammar=${cortex.#defaultGrammar ?? 'narsese-term'} temp=${cortex.#temperature ?? 0} model=${cortex.#model ?? '—'}`;
      }
      if (sub === 'on') {
        // Re-create cortex with LM service - requires restart for full effect
        return 'Cortex enable requires config change (systemOne.cortex.provider) + restart';
      }
      if (sub === 'off') {
        return 'Cortex disable requires config change (systemOne.cortex.provider=off) + restart';
      }
      if (sub === 'model' && parts[1]) {
        cortex.#model = parts[1];
        return `Cortex model set to ${parts[1]} (runtime only; persist via .s1-config)`;
      }
      if (sub === 'grammar' && parts[1]) {
        if (!['narsese-term', 'json'].includes(parts[1])) return 'Grammar must be narsese-term or json';
        cortex.#defaultGrammar = parts[1];
        return `Cortex grammar set to ${parts[1]} (runtime only; persist via .s1-config)`;
      }
      return 'Usage: .cortex on|off|status|model <id>|grammar <narsese-term|json>';
    }),
    cmd('manifold', 'Manifold health', async () => {
      const m = nar.getSystemOneManifold?.() as { health?: () => unknown } | undefined;
      if (!m) return 'Manifold: not constructed (System One disabled)';
      try { return JSON.stringify(m.health?.() ?? {}, null, 2); }
      catch (e) { return `manifold error: ${errMsg(e)}`; }
    }),
    cmd('calibrate', 'Calibration lock status: .calibrate [refresh]', async (args = '') => {
      if (args.trim().toLowerCase() === 'refresh') {
        if (!nar.isSystemOneEnabled?.()) return 'System One: disabled';
        await nar.refreshSystemOneContrastive(episodicMemory);
        const stats = nar.getSystemOneContrastive?.()?.stats() ?? {};
        const totals = Object.values(stats).reduce((a, s) => ({ p: a.p + s.positives, n: a.n + s.negatives }), { p: 0, n: 0 });
        return `Contrastive exemplars refreshed: ${totals.p}P/${totals.n}N across ${Object.keys(stats).length} rubric(s)`;
      }
      const p = '.cache/systemone/calibration-lock.json';
      if (!existsSync(p)) return 'No calibration lock (heads unfitted — pass-through mode)';
      try {
        const lock = JSON.parse(await readFile(p, 'utf-8')) as { heads?: Record<string, { abstainThreshold?: number }> };
        const heads = Object.entries(lock.heads ?? {}).map(([h, v]) => `  ${h}: abstain=${v.abstainThreshold ?? '—'}`).join('\n');
        return `lock ${statSync(p).size}B\n${heads || '  (no per-head data)'}`;
      } catch (e) { return `lock unreadable: ${errMsg(e)}`; }
    }),
    cmd('distill', 'Distillation dataset status', () => {
      const p = appConfig.systemOne?.distillation?.datasetPath ?? '.cache/systemone/dataset.jsonl';
      const st = existsSync(p) ? `${statSync(p).size}B` : 'absent';
      return `dataset ${p}: ${st}\nRun full teacher→student loop: pnpm run demo:arcade -- --distill`;
    }),
    cmd('ground', 'Groundedness gate: .ground on|off|status|threshold <0-1>', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!sub || sub === 'status') return `Groundedness gate: ${ground.enabled ? 'on' : 'off'} threshold=${ground.threshold}`;
      if (sub === 'on') { ground.enabled = true; return 'Groundedness gate enabled'; }
      if (sub === 'off') { ground.enabled = false; return 'Groundedness gate disabled'; }
      if (sub === 'threshold' && parts[1]) {
        const t = Number(parts[1]);
        if (Number.isNaN(t) || t < 0 || t > 1) return 'Threshold must be 0-1';
        ground.threshold = t;
        return `Groundedness threshold set to ${t}`;
      }
      return 'Usage: .ground on|off|status|threshold <0-1>';
    }),
    cmd('trace', 'Trace grader: .trace on|off|status|sample <0-1>|dataset', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!sub || sub === 'status') return `Trace grader: ${trace.enabled ? 'on' : 'off'} sampleRate=${trace.sampleRate} grader=${trace.grader ? 'available' : 'unavailable'}`;
      if (sub === 'on') { trace.enabled = true; return 'Trace grader enabled'; }
      if (sub === 'off') { trace.enabled = false; return 'Trace grader disabled'; }
      if (sub === 'sample' && parts[1]) {
        const r = Number(parts[1]);
        if (Number.isNaN(r) || r < 0 || r > 1) return 'Sample rate must be 0-1';
        trace.sampleRate = r;
        return `Trace sample rate set to ${r}`;
      }
      if (sub === 'dataset') {
        const dataset = (nar as any).systemOne?.dataset;
        if (!dataset) return 'Dataset not available (distillation not configured)';
        const bySource = new Map<string, number>();
        for (const l of dataset.all() as ReadonlyArray<{ source: string }>) {
          bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
        }
        const breakdown = [...bySource].map(([s, n]) => `  ${s}: ${n}`).join('\n');
        return `Dataset: ${dataset.size} labels\n${breakdown}`;
      }
      return 'Usage: .trace on|off|status|sample <0-1>|dataset';
    }),
    cmd('reflex', 'Reflex control: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!conversationGame) return 'ConversationGame not attached (System One must be enabled)';
      const focus = conversationGame.focus;
      const reflexes = focus.reflexes ?? [];
      if (!sub || sub === 'list') {
        if (reflexes.length === 0) return 'No reflexes attached';
        return reflexes.map((r: any) => `  ${r.id}: arms=${r.numArms ?? '—'} epsilon=${r.epsilon ?? '—'} budget=${r.budget?.maxCycles ?? '—'}`).join('\n');
      }
      const manifoldReflex = reflexes.find((r: any) => r.id === 'manifold-reflex');
      const lmReflex = reflexes.find((r: any) => r.id === 'lm-reflex');
      if (sub === 'manifold' && parts[1]) {
        if (parts[1] === 'on') {
          if (!manifoldReflex) return 'ManifoldReflex not attached';
          return 'ManifoldReflex already active';
        }
        if (parts[1] === 'off') {
          if (!manifoldReflex) return 'ManifoldReflex not attached';
          focus.disableReflex('manifold-reflex');
          return 'ManifoldReflex disabled';
        }
        return 'Usage: .reflex manifold on|off';
      }
      if (sub === 'lm' && parts[1]) {
        if (parts[1] === 'on') {
          if (!lmReflex) return 'LMReflex not attached (enable with lmReflex option)';
          return 'LMReflex already active';
        }
        if (parts[1] === 'off') {
          if (!lmReflex) return 'LMReflex not attached';
          focus.disableReflex('lm-reflex');
          return 'LMReflex disabled';
        }
        return 'Usage: .reflex lm on|off';
      }
      if (sub === 'budget' && parts[1]) {
        const cycles = Number(parts[1]);
        if (Number.isNaN(cycles) || cycles < 1) return 'Budget must be a positive number';
        for (const r of reflexes) {
          if (r.budget) r.budget.maxCycles = cycles;
        }
        return `Reflex budget set to ${cycles} cycles`;
      }
      if (sub === 'arms' && parts[1]) {
        const n = Number(parts[1]);
        if (Number.isNaN(n) || n < 1) return 'Arms must be a positive number';
        for (const r of reflexes) {
          if ('numArms' in r) (r as any).numArms = n;
        }
        return `Reflex arms set to ${n}`;
      }
      return 'Usage: .reflex list|manifold on|off|lm on|off|budget <cycles>|arms <n>';
    }),
    cmd('routing-auto', 'Dispatcher auto-routing: .routing-auto on|off|status|policy <conservative|balanced|aggressive>', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!sub || sub === 'status') return `Auto-routing: ${routing.auto ? 'on' : 'off'} policy=${routing.policy}`;
      if (sub === 'on') { routing.auto = true; return 'Auto-routing enabled'; }
      if (sub === 'off') { routing.auto = false; return 'Auto-routing disabled'; }
      if (sub === 'policy' && parts[1]) {
        const p = parts[1] as 'conservative' | 'balanced' | 'aggressive';
        if (!['conservative', 'balanced', 'aggressive'].includes(p)) return 'Policy must be conservative|balanced|aggressive';
        routing.policy = p;
        return `Routing policy set to ${p}`;
      }
      return 'Usage: .routing-auto on|off|status|policy <conservative|balanced|aggressive>';
    }),
    cmd('provisional', 'Provisional cache: .provisional status|flush', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const dispatcher = nar.getSystemOneDispatcher?.() as any;
        const prov = dispatcher?.#provisional ?? {};
        return `Provisional cache: ${provisional.enabled ? 'enabled' : 'disabled'} cInitial=${prov.cInitial ?? '—'} decayRate=${prov.decayRate ?? '—'} maxTtlMs=${prov.maxTtlMs ?? '—'}`;
      }
      if (sub === 'flush') {
        // The dispatcher's provisional cache is internal; we'd need to expose a flush method
        return 'Provisional cache flush not yet implemented (requires dispatcher API)';
      }
      return 'Usage: .provisional status|flush';
    }),
    cmd('meta', 'Self-meta-game: .meta status|drives|proposals|propose <type> [args...]', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      const metaGame = nar.getSelfMetaGame?.();
      if (!metaGame) return 'Self-meta-game not available (requires System One with self enabled)';

      if (!sub || sub === 'status') {
        const queues = metaGame.getGovernanceQueues?.() ?? { validation: 0, approval: 0 };
        const observes = (metaGame as any).observesFocuses ?? [];
        const cycle = (metaGame as any).cycle ?? 0;
        const knobs = metaGame.getAllKnobs?.() ?? new Map();
        return [
          'Self-Meta-Game:',
          `  ID: ${metaGame.id}`,
          `  Cycle: ${cycle}`,
          `  Observed focuses: ${observes.length ? observes.join(', ') : '(none)'}`,
          `  Governance queues: validation=${queues.validation} approval=${queues.approval}`,
          `  Knobs: ${knobs.size ? [...knobs.entries()].map(([k, v]) => `${k}=${v}`).join(', ') : '(none)'}`,
        ].join('\n');
      }
      if (sub === 'drives') {
        // Drive stimulation intensities would come from the reward gate / scheduler
        const scheduler = (metaGame as any).scheduler;
        if (!scheduler) return 'No scheduler attached (drives require scheduler)';
        return 'Drives: test_failed, contradiction_detected, low_coverage (use .drive stimulate <name>)';
      }
      if (sub === 'proposals') {
        const validation = metaGame.proposalRouter?.getAwaitingValidation?.() ?? [];
        const approval = metaGame.proposalRouter?.getAwaitingApproval?.() ?? [];
        const all = [...validation, ...approval];
        if (all.length === 0) return 'No pending proposals';
        return all.map((p: any, i: number) => `${i + 1}. ${p.kind} (${p.riskTier}) ${p.correlationId ?? ''}`).join('\n');
      }
      if (sub === 'propose' && parts[1]) {
        const type = parts[1];
        const args = parts.slice(2);
        const proposal = { kind: type, riskTier: 'low', payload: { args }, correlationId: `manual-${Date.now()}` };
        const result = metaGame.applyProposal?.(proposal) ?? { applied: false, reason: 'applyProposal not available' };
        return result.applied ? `Proposal applied: ${result.reason}` : `Proposal rejected: ${result.reason}`;
      }
      return 'Usage: .meta status|drives|proposals|propose <type> [args...]';
    }),
    cmd('s1-config', 'System One config: .s1-config show|set <path> <value>|save|reload', async (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (!sub || sub === 'show') {
        return JSON.stringify(wired.appConfig.systemOne ?? {}, null, 2);
      }
      if (sub === 'set' && parts[1] && parts[2]) {
        const path = parts[1];
        const value = parts.slice(2).join(' ');
        if (setPath(appConfig as unknown as Record<string, unknown>, `systemOne.${path}`, coerce(value))) {
          return `Set systemOne.${path} (persist with .s1-config save)`;
        }
        return `Unknown path: systemOne.${path}`;
      }
      if (sub === 'save') {
        const path = args.trim().split(/\s+/)[1] || process.env.SENARS_CONFIG || 'senars.config.json';
        await writeFile(path, JSON.stringify(appConfig, null, 2));
        return `Saved to ${path}`;
      }
      if (sub === 'reload') {
        const newConfig = await loadConfig();
        appConfig = newConfig;
        return 'Config reloaded (LM/routing changes need restart)';
      }
      return 'Usage: .s1-config show|set <path> <value>|save|reload';
    }),
    cmd('drive', 'Drive stimulation: .drive stimulate <name> [intensity]', (args = '') => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();
      if (sub !== 'stimulate' || !parts[1]) return 'Usage: .drive stimulate <name> [intensity]';
      const name = parts[1];
      const intensity = parts[2] ? Number(parts[2]) : 1.0;
      const metaGame = nar.getSelfMetaGame?.();
      if (!metaGame) return 'Self-meta-game not available';
      // Drive stimulation would go through the reward gate
      const scheduler = (metaGame as any).scheduler;
      if (!scheduler) return 'No scheduler attached (drives require scheduler)';
      const reward = intensity;
      const check = scheduler.rewardGate.process({
        eventId: `drive-${Date.now()}`,
        rewardSignal: reward,
        rewardType: 'intrinsic',
        targetType: 'policy-weights',
        targetId: 'drive',
        domain: 'self-scheduler',
      });
      return check.accepted ? `Drive ${name} stimulated (intensity=${intensity})` : `Drive ${name} rejected: ${check.rejectionReason}`;
    }),
    cmd('selftune', 'Quick 3-iteration self-tune demo', async () => {
      const { RLFPLearner } = await import('@senars/nar/rlfp');
      const { DEFAULT_COGNITIVE_PARAMETERS } = await import('@senars/nar/config/cognitive-parameters.js');
      const rlfp = new RLFPLearner({ currentParams: { ...DEFAULT_COGNITIVE_PARAMETERS } });
      let best = -Infinity;
      for (let i = 0; i < 3; i++) {
        const r = rlfp.calculateReward({ testPassRate: 0.8, avgTestDuration: 90, coverageDelta: 0.01, memoryOverage: 0.05, cpuThrottleTime: 2, baselineDuration: 100 });
        best = Math.max(best, r);
      }
      return `selftune demo: 3 iters, best reward=${best.toFixed(4)} (full run: pnpm self-tune-demo)`;
    }),
    cmd('doctor', 'Lightweight health check', async (args = '') => {
      const s = resolveLMSettings();
      const creds = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LM_API_KEY']
        .map((k) => `${k}=${process.env[k] ? 'set' : 'unset'}`).join(' ');
      let embedded = 'n/a';
      if (s.provider === 'llamacpp-embedded') {
        try {
          const { probeEmbeddedLlama } = await import('@senars/nar/lm/providers/embedded-llamacpp.js');
          const r = await probeEmbeddedLlama();
          embedded = `${r.available ? 'ok' : 'FAIL'}: ${r.detail}`;
        } catch (e) { embedded = `probe failed: ${errMsg(e)}`; }
      }
      let cfgValid = true;
      try { await loadConfig(); } catch { cfgValid = false; }
      const out = { provider: s.provider, model: s.model ?? 'default', embedded, configValid: cfgValid, creds };
      return args.includes('--json') ? JSON.stringify(out, null, 2) : `provider=${s.provider} model=${s.model ?? 'default'}\nembedded: ${embedded}\nconfig: ${cfgValid ? 'valid' : 'INVALID'}\n${creds}`;
    }),
    cmd('health', 'Quick health check', async () => {
      const s = resolveLMSettings();
      const m = nar.getSystemOneManifold?.();
      return `lm=${s.provider} systemOne=${nar.isSystemOneEnabled?.() ? 'on' : 'off'} manifold=${m ? 'up' : '—'} connections=${cm.getConnections().size}`;
    }),
    cmd('routing-log', 'Routing telemetry status', async () => {
      try {
        const { getRoutingLogStatus } = await import('@senars/nar/lm/providers.js');
        const st = getRoutingLogStatus();
        return `enabled=${st.enabled} buffered=${st.bufferSize} log=${st.logPath}`;
      } catch (e) { return `routing-log unavailable: ${errMsg(e)}`; }
    }),
    cmd('spend', 'LM spend counters', () => {
      const spend = nar.getLMClient?.()?.getSpend?.() as Record<string, { calls: number; tokensIn: number; tokensOut: number }> | undefined;
      return spend && Object.keys(spend).length
        ? Object.entries(spend).map(([p, v]) => `  ${p}: ${v.calls} calls in=${v.tokensIn} out=${v.tokensOut}`).join('\n')
        : 'No LM spend recorded';
    }),
    cmd('gates', 'Kernel gate states', () => {
      try { return Object.keys((nar as unknown as { gates?: object }).gates ?? {}).join(', ') || 'gates: n/a'; }
      catch (e) { return `gates unavailable: ${errMsg(e)}`; }
    }),
    cmd('benchmarks', 'Micro-benchmark: time NAR inference cycles', async (args = '') => {
      const cycles = Math.max(1, Math.min(200, Number(args.trim()) || 20));
      const t0 = Date.now();
      const derived = await nar.run(cycles);
      const ms = Date.now() - t0;
      return `${cycles} cycles in ${ms}ms (${(cycles / Math.max(ms, 1) * 1000).toFixed(0)} cyc/s), derivations=${derived}\nFull suites: pnpm bench`;
    }),
    cmd('webui', 'Start/stop web UI', async (args = '') => {
      const [sub] = args.trim().split(/\s+/);
      if (sub === 'stop') {
        if (webuiHandle?.close) await webuiHandle.close().catch(() => undefined);
        webuiHandle = null;
        return 'Web UI stopped';
      }
      if (webuiHandle) return 'Web UI already running';
      const port = Number(sub) || 3001;
      const { startAgentUI } = await import('../../ui/src/server/index.js');
      webuiHandle = await startAgentUI(agent as never, { port } as never).catch((e: unknown) => { throw e; });
      return `Web UI on :${port}`;
    }),
    cmd('arcade', 'Run arcade games: [games] [arms] [episodes] [seed]', async (args = '') => {
      const [games = 'snake', arms = 'heuristic,random', episodes = '2', seed = '7'] = args.trim().split(/\s+/).filter(Boolean);
      return await new Promise<string>((resolve) => {
        execFile('pnpm', ['exec', 'tsx', 'scripts/arcade.ts', '--games', games ?? '', '--arms', arms ?? '', '--episodes', episodes ?? '', '--seed', seed ?? ''],
          { timeout: 300000, maxBuffer: 1 << 20 },
          (_e, stdout, stderr) => resolve(((stdout || '') + (stderr || '')).slice(-8000) || 'arcade produced no output'));
      });
    }),
    cmd('multiagent', 'MeTTa multi-agent status', async (args = '') => {
      if ((args.trim().toLowerCase() === 'on' || args.trim().toLowerCase() === 'off'))
        return 'MeTTa is a builtin ActionGate tool (always available); NAR+MeTTa are unified by design — nothing to toggle';
      try {
        const tools = (agent as unknown as { tools?: { has?: (n: string) => boolean; list?: () => string[] } }).tools;
        const names = tools?.list?.() ?? [];
        return `metta tool: ${tools?.has?.('metta') ?? names.includes('metta') ? 'available' : 'unknown'}\n${names.length ? `tools: ${names.slice(0, 20).join(', ')}` : 'chat: Narsese routes to NAR, NL routes to LM'}`;
      } catch (e) { return `multiagent status unavailable: ${errMsg(e)}`; }
    }),
    cmd('config-show', 'Show effective config', () =>
      JSON.stringify({ profile: appConfig.profile, lm: appConfig.lm, routing: appConfig.routing, systemOne: appConfig.systemOne ? { enabled: (appConfig.systemOne as { enabled?: boolean }).enabled } : undefined }, null, 2)
    ),
    cmd('config-set', 'Set config value (dot notation)', (args = '') => {
      const [path, ...rest] = args.trim().split(/\s+/);
      if (!path || !rest.length) return 'Usage: .config-set <dot.path> <value>';
      return setPath(appConfig as unknown as Record<string, unknown>, path, coerce(rest.join(' ')))
        ? `Set ${path} (persist with .config-save)` : `Unknown path: ${path}`;
    }),
    cmd('config-save', 'Save config to file', async (args = '') => {
      const path = args.trim() || process.env.SENARS_CONFIG || 'senars.config.json';
      await writeFile(path, JSON.stringify(appConfig, null, 2));
      return `Saved to ${path}`;
    }),
    cmd('config-reload', 'Reload config from file', async () => {
      appConfig = await loadConfig();
      return 'Config reloaded (LM/routing changes need restart)';
    }),
    cmd('config-reset', 'Reset config to defaults (requires --yes)', async (args = '') => {
      if (!args.includes('--yes')) return 'Destructive. Re-run as .config-reset --yes to confirm';
      const { DEFAULT_APP_CONFIG } = await import('../config/index.js');
      appConfig = structuredClone(DEFAULT_APP_CONFIG);
      return 'Config reset to defaults (persist with .config-save; restart bot to apply)';
    }),
    cmd('auth-list', 'List connections with auth secrets', () =>
      secretIds.size ? [...secretIds].map((id) => `  ${id}: secret set`).join('\n') : '(no auth secrets set)'
    ),
    cmd('auth-add', 'Set auth secret for a connection', (args = '') => {
      const [id, secret] = args.trim().split(/\s+/);
      if (!id || !secret) return 'Usage: .auth-add <connection-id> <secret>';
      auth.setSecret(id, secret); secretIds.add(id);
      return `Secret set for ${id}`;
    }),
    cmd('auth-remove', 'Remove auth secret', (args = '') => {
      const id = args.trim();
      if (!id) return 'Usage: .auth-remove <connection-id>';
      auth.removeSecret(id); secretIds.delete(id);
      return `Secret removed for ${id}`;
    }),
  ];
}

function formatSystemOneStatus(nar: Wired['nar'], conversationGame: { focus: any } | null): string {
  const manifold = nar.getSystemOneManifold?.();
  const dispatcher = nar.getSystemOneDispatcher?.();
  const cortex = dispatcher ? (dispatcher as any).cortex : undefined;
  const groundednessGate = nar.getSystemOneGroundednessGate?.();
  const traceGrader = nar.getSystemOneTraceGrader?.();
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();

  const health = manifold?.health?.() ?? { ready: false, breakerOpen: false, rollingEce: 0, queueDepth: 0 };
  const cortexHealth = cortex?.health?.() ?? { provider: 'off', breakerOpen: true };
  const cacheMetrics = embeddingCache?.metrics?.() ?? { hits: 0, misses: 0, writes: 0, evictions: 0, size: 0 };

  const contrastive = nar.getSystemOneContrastive?.();
  const cStats = Object.entries(contrastive?.stats() ?? {});
  const totals = cStats.reduce((a, [, s]) => ({ p: a.p + s.positives, n: a.n + s.negatives, c: a.c + (s.calibrated ? 1 : 0) }), { p: 0, n: 0, c: 0 });
  const vetoes = (conversationGame?.focus?.reflexes ?? []).find((r: any) => r.id === 'lm-reflex')?.contrastiveVetoes ?? 0;

  return [
    'System One: enabled',
    `  Manifold: ${health.ready ? 'ready' : 'not ready'} (breaker: ${health.breakerOpen ? 'open' : 'closed'}, ECE: ${health.rollingEce.toFixed(4)}, queue: ${health.queueDepth})`,
    `  Dispatcher: ${dispatcher ? 'enabled' : 'disabled'}`,
    `  Cortex: ${cortexHealth.provider} (breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'})`,
    `  Groundedness Gate: ${groundednessGate ? 'enabled' : 'disabled'}`,
    `  Trace Grader: ${traceGrader ? 'enabled' : 'disabled'}`,
    `  Embedding Cache: ${cacheMetrics.size} entries, hit rate: ${(cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses || 1) * 100).toFixed(1)}%`,
    `  Contrastive: ${totals.p}P/${totals.n}N across ${cStats.length} rubric(s), ${totals.c} calibrated (refresh: .calibrate refresh)`,
    `  Contrastive Vetoes (LMReflex): ${vetoes}`,
  ].join('\n');
}

function formatSystemOneHeads(nar: Wired['nar']): string {
  const manifold = nar.getSystemOneManifold?.() as any;
  if (!manifold) return 'Manifold: not available';

  const calibrators = manifold.getCalibrators?.() ?? new Map();
  const abstainThresholds = manifold.getAbstainThresholds?.() ?? new Map();
  const heads = (manifold as any).#config?.heads ?? new Map();

  if (heads.size === 0 && calibrators.size === 0) return 'No heads registered';

  const lines = ['System One Heads:'];
  for (const [rubric, head] of heads) {
    const cal = calibrators.get(rubric);
    const abstain = abstainThresholds.get(rubric) ?? '—';
    const fitted = cal?.fitted ? 'yes' : 'no';
    const ece = cal?.getECE?.() ?? 0;
    const samples = cal?.getPoints?.()?.length ?? 0;
    lines.push(`  ${rubric}: fitted=${fitted} ECE=${ece.toFixed(4)} abstain=${abstain} samples=${samples}`);
  }
  return lines.join('\n');
}

function formatSystemOneDispatcher(nar: Wired['nar']): string {
  const dispatcher = nar.getSystemOneDispatcher?.() as any;
  if (!dispatcher) return 'Dispatcher: not available';

  const tier1 = dispatcher.tier1;
  const cortex = dispatcher.cortex;
  const cortexHealth = cortex?.health?.() ?? { provider: 'off', breakerOpen: true };
  const provisional = dispatcher.#provisional ?? {};

  const lines = [
    'System One Dispatcher:',
    `  Tier 0 (Deterministic): always active`,
    `  Tier 1 (Manifold): ${tier1 ? 'enabled' : 'disabled'}`,
    `  Tier 2 (Cortex): ${cortexHealth.provider} (breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'})`,
    `  Tier 3 (Symbolic): always active`,
    `  Provisional Cache: cInitial=${provisional.cInitial ?? '—'} decayRate=${provisional.decayRate ?? '—'} maxTtlMs=${provisional.maxTtlMs ?? '—'}`,
  ];
  return lines.join('\n');
}

function formatSystemOneCortex(nar: Wired['nar']): string {
  const dispatcher = nar.getSystemOneDispatcher?.() as any;
  if (!dispatcher) return 'Dispatcher: not available';

  const cortex = dispatcher.cortex;
  const cortexHealth = cortex?.health?.() ?? { provider: 'off', breakerOpen: true };

  const lines = [
    'System One Cortex:',
    `  Provider: ${cortexHealth.provider}`,
    `  Breaker: ${cortexHealth.breakerOpen ? 'open' : 'closed'}`,
    `  Grammar: ${cortex?.#defaultGrammar ?? 'narsese-term'}`,
    `  Temperature: ${cortex?.#temperature ?? 0}`,
    `  Model Binding: ${cortex?.#model ?? '—'}`,
  ];
  return lines.join('\n');
}

function formatSystemOneReflexes(nar: Wired['nar']): string {
  const gameManager = (nar as any).games as { attachedGames?: Map<string, { focus: any }> } | undefined;
  const attachedGames = gameManager?.attachedGames;
  if (!attachedGames || attachedGames.size === 0) return 'No games attached';

  const lines = ['System One Reflexes (per focus):'];
  for (const [gameId, entry] of attachedGames) {
    const focus = entry.focus;
    const reflexes = focus.reflexes ?? [];
    lines.push(`  ${gameId}:`);
    for (const reflex of reflexes) {
      const arms = (reflex as any).numArms ?? '—';
      const epsilon = (reflex as any).epsilon ?? '—';
      lines.push(`    ${reflex.id}: arms=${arms} epsilon=${epsilon}`);
    }
    if (reflexes.length === 0) lines.push('    (no reflexes)');
  }
  return lines.join('\n');
}

async function runNonInteractive(argv: string[]): Promise<boolean> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: pnpm run bot [-- --status|--doctor|--tune|--arcade|--multiagent] [--json]\n\nNo flags: interactive CLI (senars> ). Connections are opt-in via .connect or ENABLE_IRC/WS/HTTP/MCP=true.');
    return true;
  }
  if (argv.includes('--status')) { await import('./lib/status-report.js').then((m) => m.runStatus()); return true; }
  if (argv.includes('--doctor')) { await import('./lib/doctor-report.js').then((m) => m.runDoctor()); return true; }
  if (argv.includes('--tune')) { await import('./lib/tune-runner.js').then((m) => m.runTune()); return true; }
  if (argv.includes('--arcade')) { await import('../../scripts/arcade.js'); return true; }
  if (argv.includes('--multiagent')) { await import('./lib/multi-agent-entry.js').then((m) => m.runMultiAgentEntry()); return true; }
  return false;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (await runNonInteractive(argv)) return;

  await mkdir('.cache/sessions', { recursive: true }).catch(() => undefined);
  const wired = await createAgentFromEnv();
  const { agent, sessionManager, profile } = wired;
  const lmConfig = resolveLMConfig();
  const settings = resolveLMSettings();

  const auth = new AuthManager();
  const authCfg = readAuthConfig();
  if (authCfg.secret) for (const id of authCfg.connectionIds) auth.setSecret(id, authCfg.secret);

  const cm = new ConnectionManager();
  cm.registerFactory({ type: 'cli', create: (cfg) => new CLIConnection(cfg, { emit: () => undefined, logger }) });
  cm.registerFactory({ type: 'irc', create: (cfg) => new IRCConnection(cfg, { emit: () => undefined, logger }) });
  cm.registerFactory({ type: 'websocket', create: (cfg) => new WSConnection(cfg, { emit: () => undefined, logger }) });
  cm.registerFactory({ type: 'http', create: (cfg) => new HTTPConnection(cfg, { emit: () => undefined, logger }) });
  cm.registerFactory({ type: 'mcp', create: (cfg) => new MCPConnection(cfg, { emit: () => undefined, logger }) });

  let currentSession = sessionManager.getOrCreate('default');
  let tier: 'quality' | 'fast' | 'structured' = profile.narrateTier;
  // Groundedness gate state (shared with collectChat)
  const ground: GroundednessState = {
    enabled: wired.appConfig.systemOne?.enabled === true,
    threshold: 0.7,
    gate: wired.nar.getSystemOneGroundednessGate?.(),
  };
  // Trace grader state
  const trace: TraceState = {
    enabled: false,
    sampleRate: 0.1,
    grader: wired.nar.getSystemOneTraceGrader?.(),
    dataset: (wired.nar as any).systemOne?.dataset,
    embeddingCache: wired.nar.getSystemOneEmbeddingCache?.(),
  };
  // Auto-routing state (Phase 4)
  const routing: { auto: boolean; policy: 'conservative' | 'balanced' | 'aggressive' } = {
    auto: false,
    policy: 'balanced',
  };
  // Provisional cache state (Phase 4)
  const provisional: { enabled: boolean } = { enabled: true };

  // Bot-only default profile: enable System One by default (opt-out via config)
  // This only affects the bot; non-Bot NAR consumers are unaffected.
  if (!wired.appConfig.systemOne?.enabled) {
    wired.appConfig.systemOne = { enabled: true, manifold: { provider: 'wasi' }, cortex: { provider: 'llamacpp-embedded' }, lmReflex: true };
  }

  // Attach ConversationGameFocus for System One reflexes (Phase 3)
  let conversationGame: { focus: any; game: any } | null = null;
  if (wired.nar.isSystemOneEnabled?.()) {
    try {
      conversationGame = wired.nar.attachConversationGame?.({
        id: 'conversation',
        lmReflex: true,
      });
      if (conversationGame) {
        logger.info('ConversationGameFocus attached with reflexes');
      }
    } catch (e) {
      logger.warn('Failed to attach ConversationGameFocus', { error: errMsg(e) });
    }
    // Seed CLM contrastive exemplars from live state (hard negatives + calibration).
    wired.nar.refreshSystemOneContrastive?.(wired.episodicMemory).catch((e) =>
      logger.warn('Contrastive refresh failed at startup', { error: errMsg(e) })
    );
  }

  const core = buildCommands(wired.nar, agent, wired.lmService, sessionManager,
    () => currentSession, (s) => { currentSession = s; },
    { get: () => tier, set: (t) => { tier = t; } });
  const extra = buildExtraCommands(wired, cm, auth, ground, trace, conversationGame, routing, provisional);
  const commands = [...core.filter((c) => c.name !== 'help'), ...extra];

  const cli = new CLIConnection(
    { id: 'cli-main', type: 'cli', enabled: true, config: { name: 'CLI', commands } } as never,
    { emit: () => undefined } as never
  );
  await cli.connect();
  cli.onMessage(async (message) => { await collectChat(agent, message.text, tier, ground, trace); });
  agent.mount(cli as never);

  cli.onStateChange((state) => {
    if (state === 'disconnected') {
      sessionManager.snapshot()
        .then(() => sessionManager.close())
        .then(() => agent.stop())
        .then(() => cm.shutdownAll())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    }
  });

  const remoteRegistry = new CommandRegistry();
  for (const c of [
    ...coreCommands, ...narCommands, ...memoryCommands, ...episodesCommands,
    ...configCommands, ...lmCommands, ...rlfpCommands, ...selfCommands,
    ...connectionCommands, ...createAuthCommands(auth),
  ]) remoteRegistry.register(c);

  const autoConnect = process.env.BOT_CLI_ONLY === 'true' ? [] : createConnectionConfigsFromEnv();
  for (const cfg of autoConnect) {
    if (cfg.type === 'irc' || cfg.type === 'websocket') {
      ((cfg as { config: Record<string, unknown> }).config.greeting ??= profile.joinMessage);
    }
  }
  const ircExtra = readIRCConfig(wired.appConfig.irc);
  const ircAuto = autoConnect.find((c) => c.type === 'irc');
  if (ircAuto) {
    const c = ircAuto as { config: Record<string, unknown> };
    Object.assign(c.config, { server: ircExtra.server, port: ircExtra.port, nick: ircExtra.nick, channels: ircExtra.channels });
  }
  for (const cfg of autoConnect) {
    try {
      const conn = await cm.addConnection(
        cfg as unknown as import('@senars/core').ConnectionConfig,
        { emit: () => undefined, logger }
      );
      bindAgentToConnection(agent, conn as never, {
        auth, commandRegistry: remoteRegistry, sessionManager,
        episodicMemory: wired.episodicMemory, manager: cm,
      } as never);
      logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
    } catch (e) { logger.error(`Failed to add ${(cfg as { type: string }).type}: ${errMsg(e)}`); }
  }

  await agent.start();  if (process.env.ENABLE_WEB_UI) {
    const { startAgentUI } = await import('../../ui/src/server/index.js');
    startAgentUI(agent as never).catch((err: unknown) => { logger.error('Web UI failed to start', err as Error); });
  }

  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    await sessionManager.snapshot();
    await sessionManager.close();
    await agent.stop();
    await cm.shutdownAll();
    logger.info('Bot stopped');
  }, logger);

  console.log(`\n${profile.name} — CLI-first bot. Type .help for commands, or just chat!`);
  console.log(`LM: ${lmConfig.provider} ${lmConfig.model}${settings.provider === 'llamacpp-embedded' ? ` (gpu=${settings.llamacppGpu ?? 'auto'}:${await gpuSummary()})` : ''}`);
  logger.info(`Bot ready: ${autoConnect.length} auto-connection(s)`);
}

runEntrypoint(main);
