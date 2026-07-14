import type { CognitiveEvent } from './EventTypes.js';

export interface ToolRequestEvent extends CognitiveEvent {
  readonly type: 'tool.request';
  readonly payload: {
    readonly toolName: string;
    readonly args: Record<string, unknown>;
    readonly timeoutMs?: number;
  };
}

export interface ToolResponseEvent extends CognitiveEvent {
  readonly type: 'tool.response';
  readonly payload: {
    readonly requestId: string;
    readonly toolName: string;
    readonly result?: unknown;
    readonly error?: string;
    readonly durationMs: number;
  };
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  readonly backendId: string;
}