import type { EventLog } from '../eventlog/EventLog.js';
import type { ConfigView } from '../config/Config.js';
import type { Capability } from '../capability/Capability.js';

export interface BackendManifest {
  readonly id: string;
  readonly provides: ReadonlySet<Capability>;
  readonly requires: ReadonlySet<Capability>;
  readonly configSchema: Record<string, unknown>;
  readonly eventTypes: ReadonlySet<string>;
  readonly handles: ReadonlySet<string>;
}

export interface Backend {
  readonly id: string;
  readonly manifest: BackendManifest;

  initialize(log: EventLog, config: ConfigView): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  readonly backendId: string;
}