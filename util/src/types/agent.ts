export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

/**
 * How the engine is doing. The vocabulary lives here because the durable
 * `health` event validates against it: `Agent.health()` produced a four-way
 * union while the event that records it was `z.string()`, so nothing stopped a
 * third spelling reaching the log and a reader of the log had no way to know
 * which four words were meant.
 */
export const HEALTH_STATUSES = ['healthy', 'degraded', 'stuck', 'crashed'] as const;

export type HealthLevel = (typeof HEALTH_STATUSES)[number];

export interface HealthStatus {
  readonly status: HealthLevel;
  readonly lastCycle: number;
  readonly cycleCount: number;
  /** Engine faults per completed cycle, counted since start. */
  readonly errorRate: number;
  /** Per-engine fault counts behind `errorRate`; absent when nothing has faulted. */
  readonly byEngine?: Record<string, number>;
}

export interface SkillDefinition {
  readonly name: string;
  readonly description?: string;

  execute(...args: unknown[]): unknown;
}

/**
 * What an authenticator decided about one message: pass it, drop it silently, or
 * treat it as the binding handshake. Named because `io`'s `AuthManager` and the
 * bridge handler below both spell it out, and the union is the whole contract.
 */
export type AuthDecision = 'allow' | 'ignore' | 'auth_bound';

/** Structural auth contract satisfied by io's AuthManager (io→util edge forbids direct import). */
export interface BridgeAuthHandler {
  checkAuth(
    connectionId: string,
    senderId: string,
    message: string
  ): AuthDecision;
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
