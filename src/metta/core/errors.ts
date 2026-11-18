/**
 * MeTTa's failure vocabulary: one reason beside the shared `SenarsError` code.
 *
 * This used to be a second `ErrorCode`, declared member-for-member against the
 * one in `@senars/util/errors`, so `ErrorCode` named two different unions inside
 * one tree and neither could be read without knowing which import you held. The
 * split that actually means something is *subsystem* against *reason*: the code
 * says the MeTTa runtime refused, and the reason says what it refused about — a
 * token, an arity, a step limit. The runtime raises the reasons; the shared
 * taxonomy carries the class.
 */
import { SenarsError } from '@senars/util/errors';

export enum MeTTaReason {
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

export class MeTTaError extends SenarsError {
  constructor(
    readonly reason: MeTTaReason,
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(`[${reason}] ${message}`, 'METTA_ERROR', context, options);
    this.name = 'MeTTaError';
  }

  static parse(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(MeTTaReason.UNEXPECTED_TOKEN, msg, ctx);
  }

  static type(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(MeTTaReason.TYPE_MISMATCH, msg, ctx);
  }

  static runtime(msg: string, ctx?: Record<string, unknown>): MeTTaError {
    return new MeTTaError(MeTTaReason.UNBOUND_VARIABLE, msg, ctx);
  }
}
