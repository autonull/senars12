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

// biome-ignore lint/suspicious/noExplicitAny: BridgeOptions fields carry external types; any avoids dependency edges
export interface BridgeOptions {
  auth?: any;
  // biome-ignore lint/suspicious/noExplicitAny: options bag
  commandRegistry?: any;
  // biome-ignore lint/suspicious/noExplicitAny: options bag
  sessionManager?: any;
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
