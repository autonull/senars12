export declare const VALID_ATOM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_^";
export declare const INVALID_ATOM_CHARS_REGEX: RegExp;
export declare function isValidAtomSymbol(symbol: string): boolean;
/** Coerce arbitrary text into a valid atom symbol: invalid runs collapse to '_'. */
export declare function toAtomSymbol(text: string): string;
//# sourceMappingURL=valid-atom.d.ts.map