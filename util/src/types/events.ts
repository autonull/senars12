export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;

export interface TypedEventEmitter<EventMap extends Record<string, unknown>> {
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void;
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
  removeAllListeners(): void;
}
