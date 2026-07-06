import {Logger} from './Logger.js';

const OPEN = 1;

export function sendToClient(client, message) {
    try {
        if (client?.send && client.readyState === OPEN) {
            client.send(JSON.stringify(message));
        }
    } catch (error) {
        Logger.error('Error sending message to client:', error);
    }
}

export function broadcastToClients(clients, message) {
    if (!clients?.size) {
        return;
    }
    const serialized = JSON.stringify(message);
    for (const client of clients) {
        try {
            if (client.readyState === OPEN) {
                client.send(serialized);
            }
        } catch (error) {
            Logger.error('Error broadcasting to client:', error);
        }
    }
}
