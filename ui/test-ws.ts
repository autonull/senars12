import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';

const fastify = Fastify();
await fastify.register(fastifyWebsocket);

fastify.get('/ws', { websocket: true }, (socket) => {
  console.log('Handler called, socket type:', socket.constructor.name);
  console.log('Has send:', typeof socket.send);
  socket.send('hello');
});

await fastify.listen({ port: 3001 });
console.log('Server running');