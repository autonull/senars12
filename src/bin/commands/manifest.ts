/**
 * Command Manifest — Centralized command registration.
 *
 * Single source of truth for all top-level commands.
 * Each entry points to a module that exports a CommandModule and registers subcommands.
 */

export interface CommandManifestEntry {
  /** Command name (e.g., "run", "serve", "config"). */
  name: string;
  /** Module path relative to src/bin/commands (e.g., "./run", "./serve/index"). */
  modulePath: string;
  /** Short description for root help. */
  description: string;
}

/** All top-level commands. Order determines help display order. */
export const commandManifest: CommandManifestEntry[] = [
  { name: 'run', modulePath: './commands/run', description: 'Run agent with profile (default)' },
  { name: 'serve', modulePath: './commands/serve/index', description: 'Server commands (MCP, HTTP, WebSocket)' },
  { name: 'logic', modulePath: './commands/logic', description: 'Logic tool commands' },
  { name: 'demo', modulePath: './commands/demo/index', description: 'Demo commands (playground, arcade, imagine, benchmark)' },
  { name: 'doctor', modulePath: './commands/doctor/index', description: 'Health check and diagnostic commands' },
  { name: 'config', modulePath: './commands/config/index', description: 'Configuration commands (validate, get, set, list)' },
  { name: 'session', modulePath: './commands/session', description: 'Session management commands' },
  { name: 'memory', modulePath: './commands/memory/index', description: 'Memory commands (inspect, export, import)' },
  { name: 'model', modulePath: './commands/model', description: 'Model commands (list, pull, remove)' },
  { name: 'experiment', modulePath: './commands/experiment/index', description: 'Experiment commands (run, list, show, compare, analyze, sweep, notebook)' },
  { name: 'data', modulePath: './commands/data/index', description: 'Data commands (import, export, transform, generate, validate)' },
  { name: 'dev', modulePath: './commands/dev/index', description: 'Developer commands (repl, debug, profile, trace, inspect, benchmark, test, lint, typecheck, generate)' },
  { name: 'plugin', modulePath: './commands/plugin/index', description: 'Plugin commands (install, remove, list, update, info, dev, create, build, publish)' },
  { name: 'edge', modulePath: './commands/edge', description: 'Edge worker commands' },
  { name: 'systemone', modulePath: './commands/systemone/index', description: 'System One commands' },
  { name: 'profile', modulePath: './commands/profile', description: 'Profile management commands' },
  { name: 'lm', modulePath: './commands/lm', description: 'LM service commands' },
  { name: 'connection', modulePath: './commands/connection/index', description: 'Connection commands' },
  { name: 'dialogue', modulePath: './commands/dialogue/index', description: 'Dialogue commands' },
  { name: 'diagnostics', modulePath: './commands/diagnostics', description: 'Diagnostics commands' },
  { name: 'runtime', modulePath: './commands/runtime', description: 'Runtime commands' },
  // Stub commands (separate files)
  { name: 'wasm-bundle', modulePath: './commands/wasm-bundle', description: 'Generate WASM bundle' },
  { name: 'self-report', modulePath: './commands/self-report', description: 'Print cognitive state' },
  { name: 'imagine', modulePath: './commands/imagine', description: 'Run imagine pipeline' },
  { name: 'completion', modulePath: './commands/completion', description: 'Generate shell completions' },
];

/** Stub commands that are not yet fully implemented. */
export const stubCommands = [
  'serve http',
  'serve ws',
  'demo playground',
  'demo arcade',
  'demo imagine',
  'demo benchmark',
  'data import',
  'data export',
  'data transform',
  'data generate',
  'data validate',
  'dev repl',
  'dev debug',
  'dev profile',
  'dev trace',
  'dev inspect',
  'dev benchmark',
  'dev test',
  'dev lint',
  'dev typecheck',
  'dev generate',
  'plugin install',
  'plugin remove',
  'plugin list',
  'plugin update',
  'plugin info',
  'plugin dev',
  'plugin create',
  'plugin build',
  'plugin publish',
] as const;