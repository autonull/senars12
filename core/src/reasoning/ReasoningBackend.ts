import type { Capability } from './Capability.js';
import type {
  BackendConfig,
  BackendHealth,
  BackendInput,
  BackendResult,
  BackendSnapshot,
  ToolDefinition,
} from './BackendTypes.js';

export interface ReasoningBackend {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ReadonlySet<Capability>;

  initialize(config: BackendConfig): Promise<void>;
  shutdown(): Promise<void>;
  health(): BackendHealth;

  reason(input: BackendInput): Promise<BackendResult>;

  reasonStream?(input: BackendInput): AsyncIterable<BackendResult>;
  getTools?(): ToolDefinition[];
  getSnapshot?(): BackendSnapshot;
}
