/**
 * Codegen Barrel — Source analysis and canonicalization
 */

export * from './imports.js';
export * from './induction-inventory.js';
export * from './layer-boundary.js';
export * from './module-closure.js';
export * from './narsese-literals.js';
export * from './pkg.js';
export * from './rule-fallback.js';

// source-scan.js exports scanSubject which conflicts with analysis/attention-surface.js
// Re-export everything except scanSubject
export {
  productionSources,
  WORKSPACE_SOURCE_ROOTS,
  ALL_SOURCE_ROOTS,
  moduleSource,
  excludingGenerated,
  sourceFiles,
  lineAt,
  type SourceFilter,
} from './source-scan.js';

export * from './terms-canonical.js';