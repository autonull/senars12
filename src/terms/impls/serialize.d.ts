import type { Term } from '../types.ts';
declare const serialize: (term: Term) => string;
export declare const serializeTerm: typeof serialize;
/**
 * Canonical term → Narsese string API. Delegates to {@link serializeTerm}.
 * @public
 */
export declare const toNarsese: (term: Term) => string;
export {};
//# sourceMappingURL=serialize.d.ts.map