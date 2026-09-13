export interface WorkingMemorySlot {
  value: string;
  timestamp: number;
}

export class WorkingMemory {
  private readonly slots: Map<string, WorkingMemorySlot> = new Map();

  pin(key: string, value: string): void {
    this.slots.set(key, { value, timestamp: Date.now() });
  }

  recall(key: string): string | null {
    return this.slots.get(key)?.value ?? null;
  }

  recallAll(): Map<string, string> {
    const result = new Map<string, string>();
    for (const [key, slot] of this.slots) {
      result.set(key, slot.value);
    }
    return result;
  }

  unpin(key?: string): void {
    if (key) {
      this.slots.delete(key);
    } else {
      this.slots.clear();
    }
  }

  isSet(key: string): boolean {
    return this.slots.has(key);
  }

  keys(): string[] {
    return Array.from(this.slots.keys());
  }

  size(): number {
    return this.slots.size;
  }

  entries(): Map<string, WorkingMemorySlot> {
    return new Map(this.slots);
  }
}
