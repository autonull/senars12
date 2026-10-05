import { errMsg } from '../utils/error.js';

/**
 * The codes a `SenarsError` can carry. Every member is thrown somewhere: a code here
 * that nothing raises is a claim the taxonomy cannot keep, so the four that named
 * intentions the error surface never took (`PLUGIN_LOAD_ERROR`, `TRUTH_ERROR`,
 * `METTA_ERROR`, `SCHEMA_INDUCTION`) went when their classes did.
 */
export type ErrorCode =
  | 'TOOL_ERROR'
  | 'ENGINE_ERROR'
  | 'CONFIG_ERROR'
  | 'TRANSPORT_ERROR'
  | 'POLICY_VIOLATION'
  | 'CONNECTION_ERROR'
  | 'VALIDATION_ERROR'
  | 'OPERATION_ERROR'
  | 'LOOP_DETECTED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'EVENT_LOG_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'LM_UNAVAILABLE'
  | 'SANDBOX_TIMEOUT'
  | 'CROSS_DOMAIN'
  | 'BUILDER_ERROR'
  | 'GATE_DENIED'
  | 'BUDGET_EXCEEDED'
  | 'DIGEST_MISMATCH'
  | 'LM_OUTPUT_TOO_LARGE'
  | 'FULL'
  | 'UNAVAILABLE'
  | 'INVALID_EVENT'
  | 'SERIALIZATION_FAILED';

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
      return new SenarsError(
        error.message,
        error.code,
        { ...error.context, ...context },
        {
          cause: error,
        }
      );
    }
    const message = errMsg(error);
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

/**
 * The one subclass shape in the taxonomy: a `name`, an {@link ErrorCode}, and the
 * `(message, context, cause)` arguments all of them accepted.
 *
 * Eight classes had that constructor written out in full, so a code added to the
 * union above cost a file per code and every one of those files had to remember
 * to thread `options` through — three of them did not, so an error raised through
 * them silently dropped its cause. The taxonomy is now one declaration per code,
 * and cause threading is not optional.
 *
 * Returns the constructor only; a caller that names the instance type pairs it
 * with `export type X = InstanceType<typeof X>`.
 */
export const codedError = <N extends string, C extends ErrorCode>(name: N, code: C) => {
  const CodedError = class extends SenarsError {
    constructor(message: string, context?: Record<string, unknown>, options?: ErrorOptions) {
      super(message, code, context, options);
      this.name = name;
    }
  };
  // The class expression can only be named once, so it shares a name with every
  // other declaration from this factory. `constructor.name` is load-bearing — it
  // is what a stack frame and a test assert against — so each code claims it.
  Object.defineProperty(CodedError, 'name', { value: name });
  return CodedError;
};
