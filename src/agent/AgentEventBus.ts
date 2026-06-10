export type AgentEventKind =
    | 'agent:process:start'
    | 'agent:process:complete'
    | 'agent:process:error'
    | 'agent:suspend'
    | 'agent:resume';

export interface AgentEventPayloads {
    'agent:process:start': {input: string; sessionKey?: string; timestamp: number};
    'agent:process:complete': {input: string; output: string; sessionKey?: string; durationMs: number; tokens?: {input: number; output: number; total: number}; timestamp: number};
    'agent:process:error': {input: string; sessionKey?: string; error: string; timestamp: number};
    'agent:suspend': {timestamp: number};
    'agent:resume': {timestamp: number};
}

type AgentListener<K extends AgentEventKind> = (payload: AgentEventPayloads[K]) => void;

export class AgentEventBus {
    private readonly listeners = new Map<AgentEventKind, Set<AgentListener<AgentEventKind>>>();

    on<K extends AgentEventKind>(event: K, listener: AgentListener<K>): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener as AgentListener<AgentEventKind>);
        return () => this.off(event, listener);
    }

    off<K extends AgentEventKind>(event: K, listener: AgentListener<K>): void {
        this.listeners.get(event)?.delete(listener as AgentListener<AgentEventKind>);
    }

    emit<K extends AgentEventKind>(event: K, payload: AgentEventPayloads[K]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const listener of [...set]) {
            try {
                (listener as AgentListener<K>)(payload);
            } catch {
                // listener errors must not break the pipeline
            }
        }
    }

    removeAll(event?: AgentEventKind): void {
        if (event) this.listeners.delete(event);
        else this.listeners.clear();
    }

    listenerCount(event: AgentEventKind): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}
