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
  | 'CONFIGURATION_ERROR'
  | 'LM_UNAVAILABLE'
  | 'SANDBOX_TIMEOUT'
  | 'CROSS_DOMAIN'
  | 'BUILDER_ERROR'
  | 'GATE_DENIED'
  | 'BUDGET_EXCEEDED'
  | 'DIGEST_MISMATCH'
  | 'SCHEMA_INDUCTION'
  | 'LM_OUTPUT_TOO_LARGE';

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

  /** Enrich an unknown thrown value with operation context, preserving the cause (E4). */
  static wrap(
    error: unknown,
    context: Record<string, unknown>,
    code: ErrorCode = 'OPERATION_ERROR'
  ): SenarsError {
    if (error instanceof SenarsError) {
      return new SenarsError(error.message, error.code, { ...error.context, ...context }, {
        cause: error,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return new SenarsError(message, code, context, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  /** Safe JSON serialization for MCP error responses. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}
