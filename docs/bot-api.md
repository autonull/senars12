# SeNARS Bot API

The SeNARS bot exposes **WebSocket** (default, port 8765) and **HTTP**
(opt-in, port 8080) endpoints. Both go through the same agent and
share the same per-session context.

## Default Behavior

When you run `pnpm bot` with no environment overrides, the bot:

1. Connects to `irc.libera.chat#senars` as `senars-bot`
2. Starts a WebSocket server on `ws://localhost:8765`
3. Enables NL → Narsese translation at the IO boundary
4. Persists per-session history to `.cache/sessions/`

To enable HTTP, set `ENABLE_HTTP=true` in the env.

## WebSocket API (default)

**URL:** `ws://localhost:8765`

**Send:**
```json
{ "type": "message", "data": "Hello!", "session": "alice" }
```

`session` is optional. If provided, the bot uses that key for the
session — same key across messages preserves context. If omitted, the
bot allocates per-client-id sessions automatically.

**Receive:**
```json
{ "type": "message", "data": "Hi there!" }
```

### Python Example

```python
import json
import websocket

ws = websocket.create_connection("ws://localhost:8765")
ws.send(json.dumps({"type": "message", "data": "remember I'm Alice", "session": "alice"}))
print(ws.recv())
ws.send(json.dumps({"type": "message", "data": "what's my name?", "session": "alice"}))
print(ws.recv())
```

### Node Example

```js
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
    ws.send(JSON.stringify({type: 'message', data: 'remember I\'m Alice', session: 'alice'}));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('bot:', msg.data);
    // ask a follow-up using the same session
    ws.send(JSON.stringify({type: 'message', data: "what's my name?", session: 'alice'}));
});
```

## HTTP API (opt-in)

**URL:** `POST http://localhost:8080/chat`

**Body:**
```json
{ "text": "Hello!", "session": "alice" }
```

**Headers (if API key configured):**
```
X-API-Key: <your-key>
```

**Response:**
```json
{ "type": "response", "data": "Hi there!", "timestamp": 1234567890 }
```

## Operator Commands

Sent as a regular message starting with `/`:

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/stats` | NAR + LM statistics |
| `/episodes [n]` | Last N episodes (default 10) |
| `/lm-status` | LM client status |
| `/auth <secret>` | Authenticate on a protected connection |
| `/run [n]` | Run N inference steps |
| `/clear` | Clear NAR memory |
| `/quit` | Disconnect the current connection (does NOT kill the bot) |

## NL ↔ Narsese Translation

When `ENABLE_NL_TRANSLATION` is true (default), natural-language input
is translated to Narsese via a structured LM call before being fed to
NAR. The user sees the translated Narsese as part of the response.

Example exchange:

```
you> remember that cats are animals
bot> + (cat --> animal).
     (Stored as a belief)
```

Multi-task input is supported — paragraphs are translated into multiple
Narsese operations and batch-fed to NAR in a single round.

## Session Persistence

- Default storage: `.cache/sessions/{key}.jsonl`
- `SESSION_HISTORY_LIMIT=20` (turns per session, both directions)
- TTL eviction: 24h
- Restart-safe: sessions are restored on startup

## Rate Limiting

Default: 30 messages per minute per session key. Override with
`RATE_LIMIT_PER_MINUTE=N`.
