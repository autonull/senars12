/**
 * SeNARS Agent Layer
 * High-level interface for end-user interaction
 */

import { NAR } from '../nar/nar.js';
import { Task } from '../nar/types/core.js';

export interface Embodiment {
  readonly name: string;
  start(agent: Agent): Promise<void>;
  stop(): Promise<void>;
  send(message: string): Promise<void>;
  onMessage(handler: (message: string) => void): void;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Schema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Schema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  [key: string]: unknown;
}

export interface CommandRegistry {
  register(command: Command): void;
  get(name: string): Command | undefined;
  list(): Command[];
  execute(name: string, args: string[]): Promise<string>;
}

export interface Command {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  execute(args: string[], context: CommandContext): Promise<string>;
}

export interface CommandContext {
  nar: NAR;
  agent: Agent;
}

export interface InputProcessor {
  process(input: string): Promise<Task | null>;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  capabilities: string[];
}

export interface AgentCapabilities {
  reasoning: boolean;
  learning: boolean;
  toolUse: boolean;
  embodiment: string[];
  persistence: boolean;
  metacognition: boolean;
}

export class Agent {
  private narInstance: NAR;
  private embodiments: Embodiment[] = [];
  private tools: Map<string, Tool> = new Map();
  private commands: Map<string, Command> = new Map();
  private messageHandlers: Array<(message: string) => void> = [];
  private running = false;
  private profile: AgentProfile | null = null;
  private statePath: string | null = null;

  constructor(
    nar: NAR,
    embodiments: Embodiment[] = [],
    tools: ToolRegistry | null = null,
    commands: CommandRegistry | null = null
  ) {
    this.narInstance = nar;
    this.embodiments = embodiments;

    if (tools) {
      for (const tool of tools.list()) {
        this.tools.set(tool.name, tool);
      }
    }

    if (commands) {
      for (const command of commands.list()) {
        this.commands.set(command.name, command);
      }
    }
  }

  getNAR(): NAR {
    return this.narInstance;
  }

  getEmbodiments(): Embodiment[] {
    return this.embodiments;
  }

  addEmbodiment(embodiment: Embodiment): void {
    this.embodiments.push(embodiment);
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    for (const embodiment of this.embodiments) {
      try {
        await embodiment.start(this);
      } catch (error) {
        console.error(`Failed to start embodiment ${embodiment.name}:`, error);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;

    for (const embodiment of this.embodiments) {
      try {
        await embodiment.stop();
      } catch (error) {
        console.error(`Failed to stop embodiment ${embodiment.name}:`, error);
      }
    }
  }

  onMessage(handler: (message: string) => void): void {
    this.messageHandlers.push(handler);
  }

  async broadcast(message: string): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }
  }

  async handleInput(message: string): Promise<string> {
    if (message.startsWith('.')) {
      const parts = message.slice(1).split(/\s+/);
      const cmdName = `.${parts[0]}`;
      const args = parts.slice(1);

      const command = this.commands.get(cmdName);
      if (command) {
        try {
          return await command.execute(args, { nar: this.narInstance, agent: this });
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      return `Unknown command: ${cmdName}`;
    }

    try {
      await this.narInstance.input(message);
      return `✓ Added: ${message}`;
    } catch (error) {
      return `✗ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  setProfile(profile: AgentProfile): void {
    this.profile = profile;
  }

  getProfile(): AgentProfile | null {
    return this.profile;
  }

  getCapabilities(): AgentCapabilities {
    return {
      reasoning: true,
      learning: true,
      toolUse: this.tools.size > 0,
      embodiment: this.embodiments.map(e => e.name),
      persistence: !!this.statePath,
      metacognition: true
    };
  }

  getSelfDescription(): string {
    const caps = this.getCapabilities();
    const profile = this.profile ? this.profile.name : 'default';
    return `SeNARS Agent v12 - Profile: ${profile}
Capabilities:
  - Reasoning: ${caps.reasoning ? '✓' : '✗'}
  - Learning: ${caps.learning ? '✓' : '✗'}
  - Tool Use: ${caps.toolUse ? '✓' : '✗'}
  - Embodiments: ${caps.embodiment.join(', ') || 'none'}
  - Persistence: ${caps.persistence ? '✓' : '✗'}
  - Metacognition: ${caps.metacognition ? '✓' : '✗'}`;
  }

  async saveState(path?: string): Promise<void> {
    const fs = await import('fs/promises');
    const statePath = path || this.statePath || 'agent-state.json';
    const state = {
      profile: this.profile,
      memory: await this.narInstance.getMemoryState(),
      timestamp: Date.now()
    };
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    this.statePath = statePath;
  }

  async loadState(path?: string): Promise<void> {
    const fs = await import('fs/promises');
    const statePath = path || this.statePath || 'agent-state.json';
    const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
    if (state.profile) {
      this.profile = state.profile;
    }
    if (state.memory) {
      await this.narInstance.loadMemoryState(state.memory);
    }
    this.statePath = statePath;
  }
}
