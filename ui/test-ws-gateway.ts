import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { handleConnection } from './src/server/gateway.js';
import type { NarAdapter } from './src/server/gateway.js';

const fastify = Fastify();
await fastify.register(fastifyWebsocket);

// Mock NarAdapter
const mockNar: NarAdapter = {
  listConcepts: () => [],
  getSystemEventBus: () => ({
    on: (event, handler) => {
      return () => {};
    }
  }),
  attentionReport: () => ({ concepts: [] }),
  getDriveManager: () => undefined,
  getConfigSchema: () => ({}),
  setConfig: (key, value) => {},
};

function onChat(content, send) {
  send({ type: 'chat.agent.complete', content: `Echo: ${content}` });
}

fastify.get('/ws', { websocket: true }, (socket) => {
  console.log('Handler called, socket type:', socket.constructor.name);
  console.log('Has send:', typeof socket.send);
  handleConnection(socket, mockNar, onChat);
});

await fastify.listen({ port: 3001 });
console.log('Server running');