import net from 'net';
import WebSocket from 'ws';

/**
 * Checks if a port is free.
 * @param {number} port - The port to check.
 * @returns {Promise<boolean>} True if the port is free, false otherwise.
 */
export function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
    });
}

/**
 * Finds a free port starting from a given port.
 * @param {number} startPort - The port to start checking from.
 * @returns {Promise<number>} A free port.
 */
export async function getFreePort(startPort) {
    let port = startPort;
    while (true) {
        if (await isPortFree(port)) return port;
        port++;
    }
}

/**
 * Waits for a WebSocket server to be ready.
 * @param {string} url - The WebSocket URL to connect to.
 * @param {number} timeout - Timeout in milliseconds.
 * @returns {Promise<boolean>} True if connected, false if timed out.
 */
export async function waitForWebSocket(url, timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        try {
            await new Promise((resolve, reject) => {
                const ws = new WebSocket(url);
                ws.on('open', () => {
                    ws.close();
                    resolve();
                });
                ws.on('error', reject);
            });
            return true;
        } catch (e) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return false;
}
