import {IncomingFromClient} from '../shared/protocol.js';

export function validateClientMessage(raw: string) {
    try {
        const parsed = JSON.parse(raw);
        const result = IncomingFromClient.safeParse(parsed);
        return result;
    } catch {
        return {success: false, error: {message: 'Invalid JSON'}} as const;
    }
}
