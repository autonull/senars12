export interface MeTTaContext {
  readonly maxSteps: number;
  readonly timeout: number;
  readonly memoryLimit: number;
}

export const DEFAULT_MEMORY_LIMIT = 1024 * 1024;
