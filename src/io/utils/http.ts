import http, { type IncomingMessage } from 'node:http';
import { deadline, type Logger, readBytesBounded } from '@senars/util';
import type { WebSocketServer } from 'ws';

/**
 * Default cap on an inbound request body. A handler that trusted the peer to be
 * small was already a cliff; a ceiling is what makes it a bound.
 */
const MAX_REQUEST_BYTES = 1_048_576;

export interface ServerStartupOptions {
  port: number;
  timeout?: number;
  logger?: Logger;
  onListening?: () => void;
  onError?: (err: Error) => void;
}

/**
 * A request body as text, truncated at `maxBytes` and marked when cut.
 *
 * A request body arrives from an untrusted peer, and concatenating chunks
 * without a ceiling is the same memory cliff `readBodyBounded` refuses on the
 * outbound side: the handler that believed it was reading a small payload is
 * holding whatever was sent. Past the cap the stream is destroyed and a
 * `[truncated]` marker is appended, so the caller can tell a short body from a
 * cut one instead of parsing a silent prefix.
 */
export const parseHttpBody = (
  req: IncomingMessage,
  maxBytes = MAX_REQUEST_BYTES
): Promise<string> => readBytesBounded(req, maxBytes, () => req.destroy());

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
    const disarmDeadline = deadline(timeout, () => {
      reject(new Error(`${what} server startup timeout`));
      server.close();
    });

    server.on('listening', () => {
      disarmDeadline();
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
