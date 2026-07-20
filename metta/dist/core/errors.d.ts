export declare enum ErrorCode {
  UNEXPECTED_TOKEN = 'UNEXPECTED_TOKEN',
  UNTERMINATED_STRING = 'UNTERMINATED_STRING',
  INVALID_ESCAPE = 'INVALID_ESCAPE',
  UNMATCHED_PAREN = 'UNMATCHED_PAREN',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  UNIFICATION_FAILED = 'UNIFICATION_FAILED',
  OCCURS_CHECK = 'OCCURS_CHECK',
  INFINITE_TYPE = 'INFINITE_TYPE',
  UNBOUND_VARIABLE = 'UNBOUND_VARIABLE',
  UNKNOWN_OPERATION = 'UNKNOWN_OPERATION',
  INVALID_ARITY = 'INVALID_ARITY',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  STACK_OVERFLOW = 'STACK_OVERFLOW',
  TIMEOUT = 'TIMEOUT',
  STEP_LIMIT = 'STEP_LIMIT',
  SPACE_NOT_FOUND = 'SPACE_NOT_FOUND',
  DUPLICATE_ATOM = 'DUPLICATE_ATOM',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TENSOR_SHAPE_MISMATCH = 'TENSOR_SHAPE_MISMATCH',
  SMT_UNSAT = 'SMT_UNSAT',
}
export declare class MeTTaError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown> | undefined;
  readonly underlyingError?: Error | undefined;
  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown> | undefined,
    underlyingError?: Error | undefined
  );
  static parse(msg: string, ctx?: Record<string, unknown>): MeTTaError;
  static type(msg: string, ctx?: Record<string, unknown>): MeTTaError;
  static runtime(msg: string, ctx?: Record<string, unknown>): MeTTaError;
}
//# sourceMappingURL=errors.d.ts.map
