import http, { type IncomingMessage } from 'node:http';
import type { Logger } from '@senars/core/logger';
import type { WebSocketServer } from 'ws';

export interface ServerStartupOptions {
  port: number;
  timeout?: number;
  logger?: Logger;
  onListening?: () => void;
  onError?: (err: Error) => void;
}

export const parseHttpBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });

export const setCORSHeaders = (res: http.ServerResponse): void => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
};

interface StartupServer {
  on(event: 'listening', handler: () => void): unknown;
  on(event: 'error', handler: (err: Error) => void): unknown;
  close(): unknown;
  address(): unknown;
}

const listenWithDeadline = <T extends StartupServer>(
  server: T,
  start: () => void,
  what: string,
  timeout: number
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const failTimeout = setTimeout(() => {
      reject(new Error(`${what} server startup timeout`));
      server.close();
    }, timeout);

    server.on('listening', () => {
      clearTimeout(failTimeout);
      resolve(server);
    });

    server.on('error', (err) => {
      if (server.address()) return;
      reject(err);
    });

    start();
  });

export const startHttpServer = (
  port: number,
  handler: (req: IncomingMessage, res: http.ServerResponse) => void,
  options?: { timeout?: number }
): Promise<http.Server> => {
  const server = http.createServer(handler);
  return listenWithDeadline(server, () => server.listen(port), 'HTTP', options?.timeout ?? 10000);
};

export const startWSServer = (
  port: number,
  WSServerClass: new (options: { port: number }) => WebSocketServer,
  options?: { timeout?: number }
): Promise<WebSocketServer> => {
  const server = new WSServerClass({ port });
  return listenWithDeadline(server, () => undefined, 'WebSocket', options?.timeout ?? 10000);
};

export class ApiKeyManager {
  private _keys = new Set<string>();

  get size(): number {
    return this._keys.size;
  }

  add(key: string): void {
    this._keys.add(key);
  }

  remove(key: string): void {
    this._keys.delete(key);
  }

  has(key: string): boolean {
    return this._keys.has(key);
  }

  keys(): IterableIterator<string> {
    return this._keys.keys();
  }
}
