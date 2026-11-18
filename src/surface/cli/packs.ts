/**
 * CLI Packs — command groups for different domains.
 */

import type { CLIPack, CLICommand, CLIApp } from './types.js';

/** Pack manager. */
export class PackManager {
  private packs: Map<string, CLIPack> = new Map();
  private app: CLIApp;

  constructor(app: CLIApp) {
    this.app = app;
  }

  /** Register a pack. */
  register(pack: CLIPack): void {
    this.packs.set(pack.name, pack);
  }

  /** Get pack by name. */
  get(name: string): CLIPack | undefined {
    return this.packs.get(name);
  }

  /** List all packs. */
  list(): CLIPack[] {
    return Array.from(this.packs.values());
  }

  /** Enable pack (register its commands). */
  enable(name: string): boolean {
    const pack = this.packs.get(name);
    if (!pack) return false;

    for (const cmdName of pack.commands) {
      // Commands should be pre-registered in app
      // This just verifies they exist
      if (!this.app.commands.has(cmdName)) {
        console.warn(`Command not found in pack ${name}: ${cmdName}`);
      }
    }
    return true;
  }

  /** Disable pack (unregister its commands). */
  disable(name: string): boolean {
    const pack = this.packs.get(name);
    if (!pack) return false;

    for (const cmdName of pack.commands) {
      this.app.commands.delete(cmdName);
    }
    return true;
  }

  /** Get commands in pack. */
  getCommands(name: string): CLICommand[] {
    const pack = this.packs.get(name);
    if (!pack) return [];

    return pack.commands
      .map(cmdName => this.app.commands.get(cmdName))
      .filter((cmd): cmd is CLICommand => cmd !== undefined);
  }
}

/** Create pack manager with defaults. */
export function createPackManager(app: CLIApp): PackManager {
  const manager = new PackManager(app);

  // Core pack (always enabled)
  manager.register({
    name: 'core',
    description: 'Core system commands',
    commands: ['system-ping', 'system-version', 'system-capabilities'],
  });

  // World pack
  manager.register({
    name: 'world',
    description: 'Habitat and pack management',
    commands: [
      'world-habitat-list',
      'world-habitat-get',
      'world-habitat-run',
      'world-pack-list',
      'world-pack-run',
      'world-scorecard-get',
    ],
  });

  // Artifact pack
  manager.register({
    name: 'artifact',
    description: 'Artifact/repertoire management',
    commands: [
      'artifact-list',
      'artifact-get',
      'artifact-admit',
      'artifact-demote',
      'artifact-promote',
      'artifact-retire',
    ],
  });

  // Curriculum pack
  manager.register({
    name: 'curriculum',
    description: 'Curriculum generation and management',
    commands: [
      'curriculum-list',
      'curriculum-get',
      'curriculum-generate',
    ],
  });

  // Mining pack
  manager.register({
    name: 'mining',
    description: 'Schema mining and surprise detection',
    commands: [
      'mining-schemas',
      'mining-surprises',
    ],
  });

  // Reasoning pack
  manager.register({
    name: 'reasoning',
    description: 'Logic and reasoning tools',
    commands: [
      'logic-prove',
      'logic-query',
    ],
  });

  return manager;
}

/** Generate pack from MCP tool category. */
export function generatePackFromCategory(category: string, tools: Map<string, { name: string; description: string }>): CLIPack {
  const commands: string[] = [];
  for (const [, tool] of tools) {
    commands.push(tool.name.replace(/\./g, '-'));
  }
  return {
    name: category,
    description: `${category.charAt(0).toUpperCase() + category.slice(1)} tools`,
    commands,
  };
}