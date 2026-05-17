import type {NAR} from '../nar/nar.js';

export type ConnectionState =
    | 'idle' | 'connecting' | 'connected'
    | 'disconnecting' | 'disconnected' | 'error';

export interface IOMessage {
    readonly id: string;
    readonly source: string;
    readonly sender: string;
    readonly text: string;
    readonly timestamp: number;
    readonly metadata?: Record<string, unknown>;
}

export type MessageClassification =
    | 'command' | 'belief' | 'question'
    | 'goal' | 'natural-language' | 'unknown';

export interface Connection {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly state: ConnectionState;

    connect(): Promise<void>;

    disconnect(reason?: string): Promise<void>;

    reconnect(): Promise<void>;

    send(target: string, text: string): Promise<void>;

    onMessage(handler: (message: IOMessage) => Promise<void>): void;

    onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void;

    onError(handler: (error: ConnectionError) => void): void;

    getStatus(): { state: ConnectionState; messageCount: number; errorCount: number };

    reconfigure(config: Record<string, unknown>): Promise<void>;
}

export class ConnectionError extends Error {
    override name = 'ConnectionError';

    constructor(
        message: string,
        readonly connectionId: string,
        readonly code: string,
        readonly recoverable: boolean,
        override readonly cause?: Error,
    ) {
        super(message);
    }
}

export interface ConnectionFactory {
    readonly type: string;

    create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}

export interface ConnectionConfig {
    readonly id: string;
    readonly enabled: boolean;
    readonly type: string;
    readonly config: Record<string, unknown>;
    readonly authSecret?: string;
}

export interface ConnectionDeps {
    readonly nar: NAR;
    readonly emit: (event: string, data: unknown) => void;
    readonly logger: Logger;
}

export interface Logger {
    debug(message: string, context?: Record<string, unknown>): void;

    info(message: string, context?: Record<string, unknown>): void;

    warn(message: string, context?: Record<string, unknown>): void;

    error(message: string, error?: Error, context?: Record<string, unknown>): void;

    child(scope: string): Logger;
}