import type {ConversationSession} from '../../agent/src';
import type {NAR} from '../../nar/src';
import type {ConnectionManager} from './connection-manager.js';
import type {Connection, IOMessage} from './types.js';

export interface MessageContext {
    readonly connection: Connection;
    readonly nar?: NAR;
    readonly respond: (text: string) => Promise<void>;
    readonly sessionKey?: string;
    readonly session?: ConversationSession;
    readonly manager?: ConnectionManager;
}

export type MessageMiddleware = (
    message: IOMessage,
    context: MessageContext,
    next: () => Promise<void>
) => Promise<void>;

export class MessageRouter {
    private middleware: MessageMiddleware[] = [];

    use(middleware: MessageMiddleware): void {
        this.middleware.push(middleware);
    }

    async route(message: IOMessage, context: MessageContext): Promise<void> {
        let index = 0;

        const next = async (): Promise<void> => {
            if (index < this.middleware.length) {
                const handler = this.middleware[index++];
                if (handler) {
                    await handler(message, context, next);
                }
            }
        };

        await next();
    }
}
