export type ErrorCode =
  | 'TOOL_ERROR'
  | 'ENGINE_ERROR'
  | 'CONFIG_ERROR'
  | 'TRANSPORT_ERROR'
  | 'POLICY_VIOLATION'
  | 'CONNECTION_ERROR'
  | 'VALIDATION_ERROR'
  | 'OPERATION_ERROR'
  | 'PLUGIN_LOAD_ERROR'
  | 'TRUTH_ERROR'
  | 'LOOP_DETECTED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'EVENT_LOG_ERROR'
  | 'METTA_ERROR'
  | 'CONFIGURATION_ERROR';

export class SenarsError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SenarsError';
  }
}
