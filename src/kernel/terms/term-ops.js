/**
 * Term Operators — shared term operator definitions.
 *
 * Separated to break circular dependencies between term.ts, intern.ts,
 * formatters.ts, and narsese.ts.
 */
/** Term operator types. */
export var TermOp;
(function (TermOp) {
    TermOp["VARIABLE"] = "var";
    TermOp["CONSTANT"] = "const";
    TermOp["INHERITANCE"] = "-->";
    TermOp["SIMILARITY"] = "<->";
    TermOp["IMPLICATION"] = "==>";
    TermOp["PREDICTIVE_IMPLICATION"] = "=/>";
    TermOp["EQUIVALENCE"] = "<=>";
    TermOp["CONJUNCTION"] = "&";
    TermOp["DISJUNCTION"] = "|";
    TermOp["NEGATION"] = "~";
    TermOp["PRODUCT"] = "*";
    TermOp["EXTENSIONAL_IMAGE"] = "@";
    TermOp["INTENSIONAL_IMAGE"] = "#";
    TermOp["PREDICTION"] = "|>";
    TermOp["CONCURRENT"] = "||";
    TermOp["SEQUENTIAL"] = ";";
    TermOp["PARALLEL"] = "|~";
    TermOp["STATEMENT"] = ".";
    TermOp["QUESTION"] = "?";
    TermOp["GOAL"] = "!";
})(TermOp || (TermOp = {}));
