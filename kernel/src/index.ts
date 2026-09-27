export * from './schemas.js';
export * from './term-view.js';
export * from './rule-descriptor.js';
export * from './budget.js';
export * from './verify-derivation.js';

// `./derivation-record.js` re-declares `verifyRecord`/`VerificationResult`/`VerifyOptions` with a
// narrower, presence-only contract (deprecated). The semantics live in `./verify-derivation.js`,
// so the star export is narrowed to its non-conflicting type re-exports to keep one canonical
// verifier in the root barrel.
export type { DerivationRecord, DerivationStep, TruthValue } from './derivation-record.js';
