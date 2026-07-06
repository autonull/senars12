export enum ErrorCode {
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

export class MeTTaError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly context?: Record<string, unknown>,
    readonly cause?: Error
  ) {
    super(`[${code}] ${message}`);
    this.name = 'MeTTaError';
  }

  static parse(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, msg, ctx);
  }

  static type(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.TYPE_MISMATCH, msg, ctx);
  }

  static runtime(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(ErrorCode.UNBOUND_VARIABLE, msg, ctx);
  }
}
