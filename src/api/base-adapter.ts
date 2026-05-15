import {createLogger, type Logger} from '../nar/logger/index.js';
import {APIRegistry} from './registry.js';

export interface APIResponse {
    type: 'success' | 'error';
    id?: string;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
    timestamp: number;
}

export const successResponse = (data: Record<string, unknown>, id?: string): APIResponse =>
    ({type: 'success', id, data, timestamp: Date.now()});

export const errorResponse = (code: string, message: string, id?: string): APIResponse =>
    ({type: 'error', id, error: {code, message}, timestamp: Date.now()});

export abstract class BaseAdapter {
    protected readonly registry: APIRegistry;
    protected readonly logger: Logger;

    constructor(scope: string) {
        this.registry = APIRegistry.getInstance();
        this.logger = createLogger({scope});
    }

    protected sendJSON(ws: {send: (data: string) => void}, response: APIResponse): void {
        ws.send(JSON.stringify(response));
    }
}