export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNEXPECTED_TOKEN"] = "UNEXPECTED_TOKEN";
    ErrorCode["UNTERMINATED_STRING"] = "UNTERMINATED_STRING";
    ErrorCode["INVALID_ESCAPE"] = "INVALID_ESCAPE";
    ErrorCode["UNMATCHED_PAREN"] = "UNMATCHED_PAREN";
    ErrorCode["TYPE_MISMATCH"] = "TYPE_MISMATCH";
    ErrorCode["UNIFICATION_FAILED"] = "UNIFICATION_FAILED";
    ErrorCode["OCCURS_CHECK"] = "OCCURS_CHECK";
    ErrorCode["INFINITE_TYPE"] = "INFINITE_TYPE";
    ErrorCode["UNBOUND_VARIABLE"] = "UNBOUND_VARIABLE";
    ErrorCode["UNKNOWN_OPERATION"] = "UNKNOWN_OPERATION";
    ErrorCode["INVALID_ARITY"] = "INVALID_ARITY";
    ErrorCode["DIVISION_BY_ZERO"] = "DIVISION_BY_ZERO";
    ErrorCode["STACK_OVERFLOW"] = "STACK_OVERFLOW";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ErrorCode["STEP_LIMIT"] = "STEP_LIMIT";
    ErrorCode["SPACE_NOT_FOUND"] = "SPACE_NOT_FOUND";
    ErrorCode["DUPLICATE_ATOM"] = "DUPLICATE_ATOM";
    ErrorCode["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorCode["TENSOR_SHAPE_MISMATCH"] = "TENSOR_SHAPE_MISMATCH";
    ErrorCode["SMT_UNSAT"] = "SMT_UNSAT";
})(ErrorCode || (ErrorCode = {}));
export class MeTTaError extends Error {
    code;
    context;
    underlyingError;
    constructor(code, message, context, underlyingError) {
        super(`[${code}] ${message}`);
        this.code = code;
        this.context = context;
        this.underlyingError = underlyingError;
        this.name = 'MeTTaError';
    }
    static parse(msg, ctx) {
        return new MeTTaError(ErrorCode.UNEXPECTED_TOKEN, msg, ctx);
    }
    static type(msg, ctx) {
        return new MeTTaError(ErrorCode.TYPE_MISMATCH, msg, ctx);
    }
    static runtime(msg, ctx) {
        return new MeTTaError(ErrorCode.UNBOUND_VARIABLE, msg, ctx);
    }
}
//# sourceMappingURL=errors.js.map