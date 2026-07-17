/**
 * Configuration capability types — shared runtime config contract.
 * @public
 */

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    default?: unknown;
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
  };
}

export interface ConfigEvent {
  type: 'config.set' | 'config.delete' | 'config.schema';
  payload: {
    path: string;
    value?: unknown;
    schema?: ConfigSchema;
  };
}

export interface ConfigCapability {
  readonly schema: ConfigSchema;
  onChange(path: string, value: unknown): void;
}

export interface ConfigView {
  get<T>(path: string): T | undefined;
  getAll(prefix: string): Record<string, unknown>;
  subscribe(prefix: string): AsyncIterable<ConfigEvent>;
}
