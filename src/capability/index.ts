export type {
  AstDiff,
  CapabilityApproval,
  CapabilityDef,
  CapabilityPolicy,
  CapabilityRecord,
  CapabilityResult,
  CapabilityRisk,
  CapabilitySpaceOptions,
} from './space';
export { CapabilitySpace } from './space';
export {
  CapabilityOntology,
  createCapabilityOntology,
  type CapabilityOntologyEntry,
  type CapabilitySchema,
  type CapabilityType,
} from './ontology';
export type { WasiSandboxOptions, WasmModuleOptions } from './wasi-sandbox';
export {
  assertWasmPathContained,
  containsPath,
  createNodeVMSandbox,
  createWasiSandbox,
  createWasmModuleSandbox,
  DEFAULT_SANDBOX_TIMEOUT_MS,
  SandboxTimeoutError,
  sanitizePreopens,
  withSandboxTimeout,
} from './wasi-sandbox';
