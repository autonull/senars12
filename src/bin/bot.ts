#!/usr/bin/env tsx
/**
 * SeNARS Bot — unified interactive entry point (TODO21).
 *
 * CLI-only by default: no IRC/WS/HTTP/MCP unless ENABLE_*=true or started
 * at runtime via `.connect`. Replaces bot-ai.ts, repl.ts, status.ts,
 * doctor.ts, multi-agent.ts, tune.ts (`--status/--doctor/--tune/--arcade`
 * delegate to the original modules).
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

async function collectChat(
  agent: Agent,
  input: string,
  tier: 'quality' | 'fast' | 'structured'
): Promise<void> {
  const ctl = new AbortController();
  const onSigint = () => ctl.abort();
  process.once('SIGINT', onSigint);
  try {
    for await (const evt of agent.chat(input, { signal: ctl.signal, tier } as never)) {
      if (evt.kind === 'text-delta' && evt.text) process.stdout.write(evt.text);
      else if (evt.kind === 'tool-call') process.stdout.write(`\n[tool:${evt.toolName}]\n`);
      else if (evt.kind === 'error' || evt.kind === 'aborted') break;
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

function buildExtraCommands(w: Wired, cm: ConnectionManager, auth: AuthManager): CLICommand[] {
  const { agent, nar, sessionManager, episodicMemory, lmService, profile } = w;
  let appConfig = w.appConfig;
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
      `SeNARS Bot — CLI-first (.help, .quit, or just chat)\n\nConnection:\n  .connect irc [server] [port] [nick] [#ch1,#ch2] [--tls|--no-tls] [--password p]\n  .connect ws [port] [--greeting msg]\n  .connect http [port] [--api-key k] [--cors]\n  .connect mcp [stdio|http|sse] [--approval] [--api-key k] [--rate-limit n]\n  .disconnect <id> | .connections [id]\nCore: .stats .beliefs .concepts .attention .episodes .know .recall .sessions .session .throttle .tier .status .clear\nProfile: .profile [field value] | Skills: .skills .skill-enable .skill-disable | Memory: .consolidate .memory-stats .memory-export .memory-import\nLM: .lm-config .lm-provider .lm-model .lm-rules .routing .circuit-breakers | SystemOne: .systemone .manifold .calibrate .distill .selftune\nDiag: .doctor .health .routing-log .spend .gates | .webui [port]|stop | .arcade | .multiagent | .config-show .config-set .config-save .config-reload | .auth-list .auth-add .auth-remove`
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
      const id = args.trim().split(/\s+/)[0];
      if (!id) return 'Usage: .disconnect <connection-id>';
      try { await cm.removeConnection(id); return `Disconnected ${id}`; }
      catch (e) { return `disconnect failed: ${errMsg(e)}`; }
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
      const value = rest.join(' ');
      if (field === 'tier' && (value === 'quality' || value === 'fast' || value === 'structured')) { tier = value; return `Tier set to ${value}`; }
      if (field in profile && value) { (profile as Record<string, unknown>)[field] = value; return `profile.${field} updated`; }
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
    cmd('routing', 'Show routing matrix', async () => {
      try {
        const { getModelChain } = await import('@senars/nar/lm/providers.js');
        const cfg = resolveLMConfig();
        return (['quality', 'fast', 'structured'] as const).map((t) => `  ${t}: ${getModelChain(cfg.provider, t).join(' → ')}`).join('\n');
      } catch (e) { return `routing unavailable: ${errMsg(e)}`; }
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
    cmd('systemone', 'System One status / on|off note', (args = '') => {
      const on = nar.isSystemOneEnabled?.() ?? false;
      const sub = args.trim().toLowerCase();
      if (sub === 'on' || sub === 'off') return `System One is ${on ? 'enabled' : 'disabled'} (toggle via config systemOne.enabled + restart)`;
      return `System One: ${on ? 'enabled' : 'disabled'}`;
    }),
    cmd('manifold', 'Manifold health', async () => {
      const m = nar.getSystemOneManifold?.() as { health?: () => unknown } | undefined;
      if (!m) return 'Manifold: not constructed (System One disabled)';
      try { return JSON.stringify(m.health?.() ?? {}, null, 2); }
      catch (e) { return `manifold error: ${errMsg(e)}`; }
    }),
    cmd('calibrate', 'Calibration lock status', async () => {
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

async function runNonInteractive(argv: string[]): Promise<boolean> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: pnpm run bot [-- --status|--doctor|--tune|--arcade] [--json]\n\nNo flags: interactive CLI (senars> ). Connections are opt-in via .connect or ENABLE_IRC/WS/HTTP/MCP=true.');
    return true;
  }
  if (argv.includes('--status')) { await import('./status.js').then((m) => m.runStatus()); return true; }
  if (argv.includes('--doctor')) { await import('./doctor.js'); return true; }
  if (argv.includes('--tune')) { await import('./tune.js'); return true; }
  if (argv.includes('--arcade')) { await import('../../scripts/arcade.js'); return true; }
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
  const core = buildCommands(wired.nar, agent, wired.lmService, sessionManager,
    () => currentSession, (s) => { currentSession = s; },
    { get: () => tier, set: (t) => { tier = t; } });
  const extra = buildExtraCommands(wired, cm, auth);
  const commands = [...core.filter((c) => c.name !== 'help'), ...extra];

  const cli = new CLIConnection(
    { id: 'cli-main', type: 'cli', enabled: true, config: { name: 'CLI', commands } } as never,
    { emit: () => undefined } as never
  );
  await cli.connect();
  cli.onMessage(async (message) => { await collectChat(agent, message.text, tier); });
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
