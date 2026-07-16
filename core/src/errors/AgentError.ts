export class AgentError extends Error {
  constructor(message: string, public readonly code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentError';
  }
}

export class EngineError extends AgentError {
  constructor(public readonly engineId: string, message: string, options?: ErrorOptions) {
    super(message, `ENGINE_${engineId.toUpperCase()}`, options);
    this.name = 'EngineError';
  }
}

export class ToolError extends AgentError {
  constructor(public readonly toolName: string, message: string, options?: ErrorOptions) {
    super(message, `TOOL_${toolName.toUpperCase()}`, options);
    this.name = 'ToolError';
  }
}

export class PolicyViolation extends AgentError {
  constructor(public readonly command: string, reason: string, options?: ErrorOptions) {
    super(reason, 'POLICY_VIOLATION', options);
    this.name = 'PolicyViolation';
  }
}

export class ConfigError extends AgentError {
  constructor(message: string, public readonly path?: string, options?: ErrorOptions) {
    super(message, 'CONFIG_ERROR', options);
    this.name = 'ConfigError';
  }
}

export class TransportError extends AgentError {
  constructor(public readonly transportId: string, message: string, options?: ErrorOptions) {
    super(message, `TRANSPORT_${transportId.toUpperCase()}`, options);
    this.name = 'TransportError';
  }
}
