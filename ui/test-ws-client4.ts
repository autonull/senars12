import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'chat.user', content: 'hello' }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('error', (err) => {
  console.log('Error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason?.toString());
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);