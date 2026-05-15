import {Logger, LoggerFactory} from '../nar/logger/index.js';
import {APIRegistry} from './registry.js';

export interface APIResponse {
    type: 'success' | 'error';
    id?: string;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
    timestamp: number;
}

export abstract class BaseAdapter {
    protected readonly registry: APIRegistry;
    protected readonly logger: Logger;

    constructor(scope: string) {
        this.registry = APIRegistry.getInstance();
        this.logger = LoggerFactory.getInstance().get(scope);
    }

    protected static successResponse(
        data: Record<string, unknown>,
        id?: string
    ): APIResponse {
        return {type: 'success', id, data, timestamp: Date.now()};
    }

    protected static errorResponse(
        code: string,
        message: string,
        id?: string
    ): APIResponse {
        return {type: 'error', id, error: {code, message}, timestamp: Date.now()};
    }

    protected sendJSON(ws: {send: (data: string) => void}, response: APIResponse): void {
        ws.send(JSON.stringify(response));
    }
}