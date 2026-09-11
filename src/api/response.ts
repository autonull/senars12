/**
 * Unified API Response Helpers
 * Shared response formatting for HTTP, WebSocket, and MCP adapters
 */

export interface APIResponse<T = Record<string, unknown>> {
    type: 'success' | 'error';
    id?: string;
    data?: T;
    error?: { code: string; message: string };
    timestamp: number;
}

export const successResponse = <T extends Record<string, unknown> = Record<string, unknown>>(
    data: T,
    id?: string
): APIResponse<T> => ({
    type: 'success',
    id,
    data,
    timestamp: Date.now(),
});

export const errorResponse = (
    code: string,
    message: string,
    id?: string
): APIResponse => ({
    type: 'error',
    id,
    error: { code, message },
    timestamp: Date.now(),
});

export const sendJSON = (
    ws: { send: (data: string) => void },
    response: APIResponse
): void => {
    ws.send(JSON.stringify(response));
};

export const formatError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);