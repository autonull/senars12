export { CapabilitySpace } from './space.js';
export { createWasiSandbox, createWasmModuleSandbox, createNodeVMSandbox } from './wasi-sandbox.js';
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
export type { WasiSandboxOptions, WasmModuleOptions } from './wasi-sandbox.js';
export { DEFAULT_SANDBOX_TIMEOUT_MS, SandboxTimeoutError, assertWasmPathContained, containsPath, sanitizePreopens, withTimeout } from './wasi-sandbox.js';
