export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly lastCycle: number;
  readonly cycleCount: number;
  readonly errorRate: number;
}

export interface SkillDefinition {
  readonly name: string;
  readonly description?: string;

  execute(...args: unknown[]): unknown;
}

/** Structural auth contract satisfied by io's AuthManager (io→util edge forbids direct import). */
export interface BridgeAuthHandler {
  checkAuth(
    connectionId: string,
    senderId: string,
    message: string
  ): 'allow' | 'ignore' | 'auth_bound';
  bindUser(connectionId: string, senderId: string): void;
}

export interface BridgeOptions {
  auth?: BridgeAuthHandler;
  commandRegistry?: import('../commands/registry.js').CommandRegistry;
  sessionManager?: import('./memory.js').SessionManager;
  episodicMemory?: unknown;
  generationService?: unknown;
  understandingService?: unknown;
  manager?: unknown;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
}

export interface AgentOptions {
  log?: unknown;
  id?: string;
  cortex?: unknown;
  commandParser?: (text: string) => ParsedCommand[];
  builtinTools?: boolean;
  episodicMemory?: unknown;
}
