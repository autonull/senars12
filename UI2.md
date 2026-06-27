# UI2: Web UI ↔ SeNARS Engine Unification Plan

## The Gap

The initial UI implementation (`ui/`) is a standalone Fastify server with TODO
stubs instead of actual engine calls. The project already has a mature connector
infrastructure (`src/io/`, `src/agent/`) that all other interfaces (IRC, WS
port 8765, HTTP, CLI, MCP) use to reach the Agent and NAR. The Web UI is not
connected to any of it.

## The Goal

Wire the Web UI into the same Agent + NAR pipeline that IRC, CLI, and the IO
WebSocket use. Every `chat.user` message hits the real agent; every cognitive
state change pushes to the UI in real time; config changes rewire the engine.

## Architecture

```
User's browser
      │
      │ WebSocket (ui protocol: chat.user, config.set, etc.)
      ▼
┌─────────────────────────────────────────┐
│  ui/src/server/index.ts                 │
│  (Fastify + @fastify/websocket)         │
│                                         │
│  Creates NAR + Agent at startup         │
│  (same pattern as src/bin/bot-ai.ts)    │
│                                         │
│  agent.chat() for chat messages         │
│  nar.getSystemEventBus().on() for       │
│    real-time cognitive events           │
└────────────┬────────────────────────────┘
             │
             │  direct in-process calls
             ▼
┌─────────────────────────────────────────┐
│  Agent + NAR                            │
│  (src/agent/, src/nar/)                 │
│                                         │
│  Same instances, same lifecycle as      │
│  bot-ai.ts creates                       │
└─────────────────────────────────────────┘
```

The UI server becomes equivalent to any other `Connection` type — it calls the
exact same `agent.chat()` and subscribes to the same event bus that the IO
middleware pipeline uses.

## Verified API Signatures

All calls below have been verified against the actual source code:

| API | File | Signature |
|---|---|---|
| `SeNARSFactory.createDefault(opts)` | `src/nar/factory.ts:66` | `(opts?: SeNARSOptions) => NAR` |
| `createAgent(opts)` | `src/agent/agent.ts:5` | `(opts?: AgentOptions) => Agent` |
| `DEFAULT_NAR_CONFIG` | `src/config/defaults.ts:10` | `Partial<NARConfig>` |
| `agent.chat(input, {stream:true})` | `src/agent/core/AgentImpl.ts:131` | `AsyncGenerator<ChatStreamEvent, string>` |
| `agent.getNAR()` | `src/agent/core/AgentImpl.ts:274` | `() => NAR | undefined` |
| `agent.start()` | `src/agent/core/AgentImpl.ts:198` | `() => () => void` (returns stop fn) |
| `nar.getSystemEventBus()` | `src/nar/nar.ts:252` | `() => AgentEventBus` |
| `nar.listConcepts()` | `src/nar/nar.ts:195` | `() => Concept[]` |
| `nar.attentionReport()` | `src/nar/nar.ts:331` | `() => { concepts: Array<{term, priority}>, total }` |
| `nar.getBeliefs()` | `src/nar/nar.ts:367` | `() => Task[]` |
| `nar.getEventBus()` | `src/nar/nar.ts:248` | `() => NarEventBus` (raw) |
| `Concept.term` | `src/nar/memory/concept.ts:36` | `Term` (`.toString(): string`) |
| `Concept.priority` | `src/nar/memory/concept.ts:61` | `number` (getter) |
| `Concept.getLinks()` | `src/nar/memory/concept.ts:148` | `() => ConceptLink[]` |
| `ConceptLink.concept` | `src/nar/memory/concept.ts:25` | `Concept` |
| `ConceptLink.strength` | `src/nar/memory/concept.ts:26` | `number` |

### Event Bus: Known Issue

`AgentImpl.on()` (`src/agent/core/AgentImpl.ts:421`) subscribes to
`nar.getEventBus()` (the raw `NarEventBus`) instead of `nar.getSystemEventBus()`
(the `AgentEventBus` that has translated `nar:*` events via
`wrapNarEventBus()`). This means `agent.on('nar:derivation')` will not receive
events.

**Workaround**: Subscribe to `nar.getSystemEventBus().on()` directly for
cognitive events. A fix to `AgentImpl.on()` should be applied (change
`nar.getEventBus?.()` to `nar.getSystemEventBus?.()` on line 423).

## Protocol Translation

| UI WS Message | Engine Call | Response |
|---|---|---|
| `chat.user` | `agent.chat(input, {stream:true})` | `chat.agent.stream` (per text-delta), `chat.agent.complete` |
| `config.set` | `nar.configure()` or agent reconfig | (ack logged) |
| (server push) | `nar.getSystemEventBus().on('nar:derivation')` | `cognitive.update { module: 'belief_graph', data }` |
| (server push) | `nar.getSystemEventBus().on('nar:concept:activated')` | `cognitive.update { module: 'working_memory', data }` |
| (server push) | `nar.getSystemEventBus().on('nar:reasoning:cycle')` | `cognitive.update { module: 'stream_reasoner', data }` |
| (server push) | `nar.getSystemEventBus().on('nar:drive:changed')` | `cognitive.update { module: 'drives', data }` |
| (server push) | `agent.on('agent:process:*')` | status updates |
| (on connect) | `nar.attentionReport()` + `nar.listConcepts()` | `config.schema`, initial graph elements |

## Phase 1: Engine Integration in the UI Server

### 1a. Required imports

The UI server imports from the monorepo root `src/`. The relative path from
`ui/src/server/index.ts` to the root `src/` is `../../../src/`.

```typescript
import { SeNARSFactory } from '../../../src/nar/factory.js';
import { createAgent } from '../../../src/agent/agent.js';
import { DEFAULT_NAR_CONFIG } from '../../../src/config/index.js';
```

### 1b. Rewrite `ui/src/server/index.ts`

Replace the stubs with real engine calls. Key differences from the current code:

1. Import path: `../../../src/nar/factory.js` (not `../../src/nar/factory.js`)
2. Static root: `path.join(__dirname, '../../dist/client')` (two levels up from
   `dist/server/` to reach `dist/client/`)
3. Cognitive events use `nar.getSystemEventBus().on()` (not `agent.on()`)
4. Agent lifecycle handled by `agent.start()` (which returns a stop function)
5. `ConceptLink.concept.term.toString()` for graph edge targets

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import type WebSocket from 'ws';
import { z } from 'zod';

import { SeNARSFactory } from '../../../src/nar/factory.js';
import { createAgent } from '../../../src/agent/agent.js';
import { DEFAULT_NAR_CONFIG } from '../../../src/config/index.js';
import type { Concept } from '../../../src/nar/memory/concept.js';
import type { NAR } from '../../../src/nar/nar.js';
import { ConfigSchema } from '../shared/protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const nar = SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG});
  const agent = createAgent({ nar });
  const stopAgent = agent.start();

  const fastify = Fastify({ logger: true });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../dist/client'),
    prefix: '/',
  });

  fastify.register(fastifyWebSocket);

  fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const schemaMsg: z.infer<typeof ConfigSchema> = {
      type: 'config.schema',
      data: {
        'llm.temperature': { type: 'slider', label: 'LLM Temperature', value: 0.7, min: 0, max: 2 },
        'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1 },
      },
    };
    socket.send(JSON.stringify(schemaMsg));

    socket.send(JSON.stringify({
      type: 'cognitive.update',
      module: 'belief_graph',
      data: { elements: buildGraphElements(nar) },
    }));

    const sysBus = nar.getSystemEventBus();
    const unsubs = [
      sysBus.on('nar:derivation', () => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'belief_graph',
          data: { elements: buildGraphElements(nar) },
        }));
      }),
      sysBus.on('nar:concept:activated', (d) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'working_memory',
          data: { concept: d.term, priority: d.priority },
        }));
      }),
      sysBus.on('nar:reasoning:cycle', (d) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'stream_reasoner',
          data: { cycle: d.cycle, derived: d.derived },
        }));
      }),
    ];

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'chat.user') {
          const stream = agent.chat(msg.content, { stream: true });
          for await (const event of stream) {
            if (event.kind === 'text-delta') {
              socket.send(JSON.stringify({ type: 'chat.agent.stream', delta: event.text }));
            }
            if (event.kind === 'finish') {
              socket.send(JSON.stringify({ type: 'chat.agent.complete', content: event.text }));
            }
            if (event.kind === 'error') {
              socket.send(JSON.stringify({ type: 'chat.agent.complete', content: `Error: ${event.error}` }));
            }
          }
        }
        if (msg.type === 'config.set') {
          fastify.log.info(`Config update: ${msg.key} = ${msg.value}`);
        }
      } catch (e) {
        fastify.log.error({ err: e }, 'WS message error');
      }
    });

    socket.on('close', () => { for (const u of unsubs) u(); });
  });

  fastify.setNotFoundHandler((_req, reply) => { reply.sendFile('index.html'); });
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
}

function buildGraphElements(nar: NAR): any[] {
  const concepts = nar.listConcepts();
  const elements: any[] = [];
  const nodeIds = new Set<string>();

  for (const c of concepts) {
    const id = c.term.toString();
    nodeIds.add(id);
    elements.push({
      group: 'nodes',
      data: {
        id,
        color: c.priority > 0.5 ? '#00f3ff' : '#334155',
        size: Math.max(10, c.priority * 40),
      },
    });
  }

  for (const c of concepts) {
    const src = c.term.toString();
    for (const link of c.getLinks()) {
      const tgt = link.concept.term.toString();
      if (nodeIds.has(tgt)) {
        elements.push({ group: 'edges', data: { source: src, target: tgt } });
      }
    }
  }

  return elements;
}

main();
```

### 1c. Build configuration

The server now imports from `../../../src/`. Since these files are outside the
`ui/` directory, tsup will bundle them. No extra configuration is needed beyond
ensuring the tsconfig `include` paths (already covered) and that tsup can
resolve the monorepo source. The existing `tsup.config.ts` handles this.

### 1d. Fix `AgentImpl.on()` event bus subscription (recommended)

In `src/agent/core/AgentImpl.ts:423`, change:
```typescript
const systemEventBus = this.nar?.getEventBus?.();
```
to:
```typescript
const systemEventBus = this.nar?.getSystemEventBus?.();
```

This ensures `agent.on('nar:derivation')` and other `nar:*` events work
correctly. Without this fix, all subscribers to `nar:*` events via `agent.on()`
will silently receive nothing.

## Phase 2: Config → Engine Wiring

Map `config.set` messages to actual NAR configuration keys. NAR does not expose
a generic `configure()` method, so specific handlers are needed:

```typescript
interface ConfigHandler { label: string; type: ConfigFieldType; set: (v: any) => void }

const configHandlers = new Map<string, ConfigHandler>([
  ['llm.temperature', {
    label: 'LLM Temperature',
    type: 'slider',
    set: (v) => { /* no direct LM temp API yet — store for later use */ },
  }],
  ['nars.revision_rate', {
    label: 'NARS Revision Rate',
    type: 'slider',
    set: (v) => { nar.getDriveManager()?.setUrgency(v as number); },
  }],
]);
```

When a new WebSocket client connects, the server sends the current config
values by reading from the handlers' internal state.

## Phase 3: UI Protocol Schema Alignment

The UI protocol (`ui/src/shared/protocol.ts`) currently duplicates concepts
from the project's existing message types. To align:

1. Import `ChatStreamEvent` from `../../../src/agent/types.js` and use its
   `kind` field (`text-delta`, `finish`, `error`) as the wire format for chat
   streaming, rather than the UI's custom `chat.agent.stream` / `.complete`.
2. Add a `src/shared/` directory at the monorepo root (not inside `ui/`) for
   the WebSocket protocol types shared between the IO WS connection (port 8765)
   and the UI WS (port 3000).
3. The UI-specific protocol can remain simpler than the internal `IOMessage`
   envelope since it has different concerns (real-time graph, config controls).

### Immediate alignment step

Add a `ChatStreamEvent` -> UI protocol adapter in the server:

```typescript
// Inside the ws.on('message') handler:
if (event.kind === 'text-delta') {
  socket.send(JSON.stringify({ type: 'chat.agent.stream', delta: event.text }));
}
// This is already correct — just keep this translation layer
```

## Phase 4: Entry Point

The UI server can be launched as a standalone process (like `bot-ai.ts`):

```bash
pnpm --filter senars-ui start
```

Or added to the main bot process via an env flag in `src/bin/bot-ai.ts`:

```typescript
if (process.env.ENABLE_WEB_UI) {
  const { startWebUI } = await import('../../ui/src/server/index.js');
  startWebUI(nar, agent);  // pass existing instances instead of creating new ones
}
```

The standalone approach is recommended for development (separate process, can
restart UI independently). Embedded mode is better for production (single
process, shared NAR state).

## Remaining Work from UI.md

| UI.md Item | Status | Remaining |
|---|---|---|
| Phase 1: Typed Contract | Done | — |
| Phase 2: Server (stubs) | Done | Replace stubs with real Agent calls (Phase 1b above) |
| Phase 3: Theme CSS | Done | — |
| Phase 4: Chat Console | Done | — |
| Phase 5: Config Drawer | Done | — |
| Phase 6: Cognitive HUD | Done | Backend needs real cognitive data pushes (Phase 1b) |
| Phase 7: Assembly | Done | — |
| No Mocks Rule 1 (No hardcoded state) | Done | — |
| No Mocks Rule 2 (Zod enforcement) | Done | — |
| No Mocks Rule 3 (Graceful degradation) | Done | — |
| No Mocks Rule 4 (Backend agnosticism) | **TODO** | Server still has business logic stubs; replace with real SeNARS bridge (Phase 1b) |

## Open Questions

1. **Process model**: Standalone (`pnpm --filter senars-ui start`) vs embedded
   in main bot process (`ENABLE_WEB_UI=true`). The plan recommends standalone
   for dev, embedded for production.

2. **Config schema source of truth**: Currently hardcoded. The NAR does not
   expose a `getConfigSchema()` method. A future enhancement could expose NAR
   config knobs (LM temperature, urgency, etc.) as a Zod schema so the UI
   always reflects available controls.

3. **AgentImpl event bus bug**: `AgentImpl.on()` line 423 calls
   `nar.getEventBus()` instead of `nar.getSystemEventBus()`. This should be
   fixed to make `agent.on('nar:*')` work. Without the fix, cognitive event
   subscribers via `agent.on()` receive nothing.

4. **Protocol unification**: The UI WS protocol is intentionally simpler than
   the IO WS protocol. The question is whether to eventually converge them or
   keep them separate. The plan recommends keeping them separate — the UI
   protocol is designed for rich real-time rendering (graph data, config forms)
   while the IO WS protocol is designed for chat + command dispatch.

5. **Authentication**: The IO middleware pipeline has auth middleware. The UI WS
   currently has none. Should the UI require auth (e.g. token in URL or first
   message) before processing commands?
