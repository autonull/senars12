export type {
  AstDiff,
  CapabilityApproval,
  CapabilityDef,
  CapabilityPolicy,
  CapabilityRecord,
  CapabilityResult,
  CapabilityRisk,
  CapabilitySpaceOptions,
} from './space.js';
export { CapabilitySpace } from './space.js';
export type { WasiSandboxOptions, WasmModuleOptions } from './wasi-sandbox.js';
export {
  assertWasmPathContained,
  containsPath,
  createNodeVMSandbox,
  createWasiSandbox,
  createWasmModuleSandbox,
  DEFAULT_SANDBOX_TIMEOUT_MS,
  SandboxTimeoutError,
  sanitizePreopens,
  withTimeout,
} from './wasi-sandbox.js';
