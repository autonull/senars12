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
import { SenarsError } from '@senars/errors';
export var MeTTaReason;
(function (MeTTaReason) {
    MeTTaReason["UNEXPECTED_TOKEN"] = "UNEXPECTED_TOKEN";
    MeTTaReason["UNTERMINATED_STRING"] = "UNTERMINATED_STRING";
    MeTTaReason["INVALID_ESCAPE"] = "INVALID_ESCAPE";
    MeTTaReason["UNMATCHED_PAREN"] = "UNMATCHED_PAREN";
    MeTTaReason["TYPE_MISMATCH"] = "TYPE_MISMATCH";
    MeTTaReason["UNIFICATION_FAILED"] = "UNIFICATION_FAILED";
    MeTTaReason["OCCURS_CHECK"] = "OCCURS_CHECK";
    MeTTaReason["INFINITE_TYPE"] = "INFINITE_TYPE";
    MeTTaReason["UNBOUND_VARIABLE"] = "UNBOUND_VARIABLE";
    MeTTaReason["UNKNOWN_OPERATION"] = "UNKNOWN_OPERATION";
    MeTTaReason["INVALID_ARITY"] = "INVALID_ARITY";
    MeTTaReason["DIVISION_BY_ZERO"] = "DIVISION_BY_ZERO";
    MeTTaReason["STACK_OVERFLOW"] = "STACK_OVERFLOW";
    MeTTaReason["TIMEOUT"] = "TIMEOUT";
    MeTTaReason["STEP_LIMIT"] = "STEP_LIMIT";
    MeTTaReason["SPACE_NOT_FOUND"] = "SPACE_NOT_FOUND";
    MeTTaReason["DUPLICATE_ATOM"] = "DUPLICATE_ATOM";
    MeTTaReason["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    MeTTaReason["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    MeTTaReason["TENSOR_SHAPE_MISMATCH"] = "TENSOR_SHAPE_MISMATCH";
    MeTTaReason["SMT_UNSAT"] = "SMT_UNSAT";
})(MeTTaReason || (MeTTaReason = {}));
export class MeTTaError extends SenarsError {
    reason;
    constructor(reason, message, context, options) {
        super(`[${reason}] ${message}`, 'METTA_ERROR', context, options);
        this.reason = reason;
        this.name = 'MeTTaError';
    }
    static parse(msg, ctx) {
        return new MeTTaError(MeTTaReason.UNEXPECTED_TOKEN, msg, ctx);
    }
    static type(msg, ctx) {
        return new MeTTaError(MeTTaReason.TYPE_MISMATCH, msg, ctx);
    }
    static runtime(msg, ctx) {
        return new MeTTaError(MeTTaReason.UNBOUND_VARIABLE, msg, ctx);
    }
}
