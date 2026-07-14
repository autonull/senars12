import type { CognitiveEvent } from '../CognitiveEvent.js';
import type { ChatMessage, GraphNodeData } from '../Protocol.js';
import type { Capability } from './Capability.js';

export interface BackendConfig {
  [key: string]: unknown;
}

export interface BackendInput {
  readonly type: 'chat' | 'belief' | 'goal' | 'question' | 'skill' | 'raw';
  readonly content: string;
  readonly context?: ReasoningContext;
  readonly correlationId: string;
}

export interface BackendResult {
  readonly backendId: string;
  readonly success: boolean;
  readonly output?: BackendOutput;
  readonly error?: string;
  readonly events: CognitiveEvent[];
  readonly graphDelta?: GraphDelta;
  readonly toolsInvoked?: ToolInvocation[];
}

export interface BackendOutput {
  readonly type: string;
  readonly value: unknown;
  readonly label?: string;
}

export interface GraphDelta {
  readonly nodes: GraphNodeData[];
  readonly edges: GraphEdgeData[];
}

export interface GraphEdgeData {
  readonly source: string;
  readonly target: string;
  readonly weight?: number;
  readonly type?: string;
  readonly directed?: boolean;
}

export interface ReasoningContext {
  readonly conversationHistory: ChatMessage[];
  readonly activeGoals: string[];
  readonly workingMemory: WorkingMemorySnapshot;
  readonly timestamp: number;
}

export interface WorkingMemorySnapshot {
  readonly concepts: string[];
  readonly derivations: number;
}

export interface ToolInvocation {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result?: unknown;
}

export interface BackendSnapshot {
  readonly backendId: string;
  readonly capabilities: Capability[];
  readonly state: Record<string, unknown>;
  readonly timestamp: number;
}

export interface BackendHealth {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly detail?: string;
  readonly metrics?: Record<string, number>;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  readonly execute: (args: Record<string, unknown>) => Promise<unknown>;
}
