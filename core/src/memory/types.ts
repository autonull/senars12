export interface MemoryEntry {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly correlationId?: string;
}

export interface MemoryQuery {
  readonly type?: string;
  readonly limit?: number;
  readonly from?: number;
  readonly to?: number;
}
