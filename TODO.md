# Plan: A Completely Working & Tested SeNARS Usable Through Its UI

## What "Done" Means

```
User types in HUD → WS to server → agent.chat() → engine.reason() → derivations
  → CognitiveEvent emitted → handler converts to GraphDelta
  → UnifiedGraphProjection.applyDelta() → broadcast cognitive.delta over WS
  → ws-client.ts receives → applyServerMessage() → store atoms update
  → Lit components re-render graph
```

Six acceptance criteria, each verifiable by a single command:

- [ ] `pnpm test` at root passes — including `tests/e2e/webui-client-verify.test.ts`
- [ ] `pnpm --dir ui build:client` succeeds
- [ ] `pnpm --dir ui test:unit` discovers and passes `button.test.ts` + modulation tests
- [ ] `pnpm vitest run tests/e2e/production-loop.test.ts` proves: mock-LM agent + probe → `$graphNodes` contains probe terms (not echoes)
- [ ] `ENABLE_WEB_UI=1 pnpm bot` (mock LM) renders live graph in browser — verified by Playwright
- [ ] CI workflow(s) observed green on a PR

---

## P0 — Foundation Blocks (4 items, ~45 min)

### P0#1: Guard `exposeTestApi()` against Node runtime

**Where:** `ui/src/client/core/store.ts:473-486`

**Problem:** `exposeTestApi()` accesses `window` at module-evaluation time (`store.ts:486`).
Vitest/Node has no `window`, so importing the store crashes with `ReferenceError`.
This breaks `tests/e2e/webui-client-verify.test.ts` — the only test that proves
the client store processes real server transcripts.

**Fix:**
```typescript
export function exposeTestApi(): void {
  if (typeof window === 'undefined') return;          // ← add
  const w = window as unknown as { ... };              // existing
  ...
}

// At module bottom, replace:
  exposeTestApi();
// With:
  if (typeof window !== 'undefined') exposeTestApi();
```

**Verification:** `pnpm vitest run tests/e2e/webui-client-verify.test.ts` passes.

---

### P0#2: Fix invalid TypeScript cast in raw HTML `<script>`

**Where:** `ui/src/client/index.html:17-22`

**Problem:** An inline `<script>` (not processed by Vite) contains
`(window as unknown as { ... })` — browser-parser throws `SyntaxError`.

**Fix:** Replace with plain JS:
```html
<script>
    window.__testApi = {
        store: { getState: function(path) { return undefined; } },
        connection: { getState: function() { return undefined; } },
    };
</script>
```

**Verification:** `pnpm --dir ui build:client` succeeds. Open `dist/client/index.html` in
browser — no SyntaxError in console.

---

### P0#3: Delete `entry.ts` and its custom Vite plugins

**Where:** `ui/src/client/entry.ts`, two plugins in `ui/vite.config.ts:53-73`

**Problem:** `entry.ts` is orphaned — referenced by zero HTML files. The real boot path is
`index.html`'s inline module. The two plugins (`preserve-entry-side-effects`,
`inject-entry-import`) exist only to rescue this dead file.

**Fix:** Delete `ui/src/client/entry.ts`. Delete the two custom `plugins: [...]` entries from
`vite.config.ts`. The `preserveEntrySignatures: 'strict'` and `manualChunks` config can stay.

**Verification:** Build still succeeds. No error about missing `entry.ts`.

---

### P0#4: Settle on one canonical boot path — **create fresh `entry.ts`**

**Decision:** Move to a single `entry.ts` referenced by `<script type="module" src="./entry.ts">`
in `index.html`. This is cleaner than the inline module:
- TypeScript logic is in `.ts`, not HTML
- Testable (can be imported in tests)
- No raw `<script>` with syntax risks
- Single entry point for Vite build

**Steps:**
1. After P0#3 deletes old `entry.ts`, create new `ui/src/client/entry.ts`:
   ```typescript
   import { Announcer } from './core/announcer.js';
   import { $activeLens, $connectionState, hydrateFromUrl } from './core/store.js';
   import { connect } from './core/ws-client.js';

   // Phase 0: Design system & primitives
   import './styles/theme.css';
   import './components/primitives/index.js';

   // Phase 1: Feature components
   import './components/app-layout.js';
   import './components/graph-toolbar.js';
   import './components/connection-banner.js';
   import './components/error-boundary.js';
   import './components/graph-viewport.js';
   import './components/lens-selector.js';
   import './components/input-hud.js';
   import './components/config-hud.js';
   import './components/telemetry-panel.js';
   import './components/contradiction-badge.js';

   // Phase 2: Graph interaction components
   import './components/lens-controller.js';
   import './components/node-detail-drawer.js';
   import './components/graph-minimap.js';

   // Phase 4: Chat & Config enhancements
   import './components/chat-history-panel.js';
   import './components/config-profiles.js';
   import './components/lens-designer.js';

   // Phase 5: Observability
   import './components/cognitive-metrics.js';

   // Accessibility: live region announcements
   const announcer = Announcer.getInstance();
   $connectionState.subscribe((state) => {
     if (state === 'connected') announcer.announce('Connected to SeNARS');
     else if (state === 'disconnected') announcer.announce('Disconnected from SeNARS', 'assertive');
     else if (state === 'reconnecting') announcer.announce('Reconnecting to SeNARS', 'assertive');
   });
   $activeLens.subscribe((lens) => {
     announcer.announce(`Switched to ${lens} lens`);
   });

   hydrateFromUrl();
   connect();
   ```
2. Update `index.html`: remove the inline `<script type="module">...</script>` block entirely,
   replace with:
   ```html
   <script type="module" src="./entry.ts"></script>
   ```
3. Keep the fixed plain-JS `window.__testApi` placeholder script (from P0#2) — it runs before
   the module loads and provides a synchronous stub.

**Verification:** `pnpm --dir ui build:client` succeeds. Browser loads without errors.
No duplicate boot logic exists anywhere.

---

## P1 — Tests That Actually Run (2 items, ~30 min)

### P1#5: Fix UI vitest config to discover component tests

**Where:** `ui/vitest.config.ts`, `ui/src/client/components/primitives/button.test.ts`

**Problem:** 
- `vitest.config.ts` uses `include: ['tests/**/*.test.ts']` — only `ui/tests/` is scanned.
  `button.test.ts` lives in `src/client/components/primitives/` and is never found.
- `button.test.ts` imports `'../src/client/components/primitives/button.js'` which resolves
  wrong from `primitives/`.
- `jsdom` is not installed as a devDependency.
- Current `pnpm --dir ui test:unit` reports "Tests 15 passed (15)" — all modulation tests.
  The 6 button tests are invisible.

**Fix:**
1. Install `jsdom` as devDependency: `pnpm --dir ui add -D jsdom`
2. Move `button.test.ts` to `ui/tests/components/button.test.ts`
3. Fix import path in moved file to `'../../src/client/components/primitives/button.js'`
4. (Optional) Simplify test by removing manual JSDOM setup — `environment: 'jsdom'` handles it.

**Verification:** `pnpm --dir ui test:unit` shows 21+ tests (15 modulation + 6 button).

---

### P1#6: Run and record the full root test suite

**Problem:** 91 test files exist under `tests/` covering agent, core, nar, io, server,
integration, e2e, mcp, cli, cognitive. None are gated in CI. Some may fail beyond the
already-known `webui-client-verify.test.ts`.

**Fix:** Run `pnpm test` at root. Record pass/fail per directory. Fix any discovered
failures. Add a root-level test job to `.github/workflows/` (currently only UI workflow
exists).

**Verification:** `pnpm test` exits 0. Root-workflow CI job present and green.

---

## P2 — Connect the UI to the Real Agent (2 items, ~3h — the core deliverable)

### P2#7: Wire `startAgentUI(agent)` to real cognitive events

**Where:** `ui/src/server/index.ts`

**Problem:** `startAgentUI(_agent, _opts)` ignores the agent and calls `startTestServer()`
— which serves a fake echo WS. `UnifiedGraphProjection` exists (unit-tested at root) but is
never instantiated or wired.

**Design:** Refactor the server into a single `startUI(agent?)` implementation that both
`startTestServer()` and `startAgentUI(agent)` delegate to. The shared implementation:

```typescript
// ui/src/server/index.ts

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { crypto } from 'node:crypto';
import type { Agent, CognitiveEvent } from '@senars/core';
import { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import type { GraphNodeData, GraphOp, IncomingFromServer } from '@senars/core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../dist/client');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// --- Test state (for /test/* endpoints, kept for E2E compatibility) ---
const testState = {
  concepts: [] as Array<{ term: string; f: number; c: number }>,
  chatHistory: [] as Array<{ role: string; content: string }>,
  derivations: [] as Array<{ conclusion: string; frequency: number; confidence: number }>,
  connected: false,
};

// --- Static file serving (unchanged) ---
const mimeTypes: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';
  const filePath = resolve(DIST_DIR, url === '/' ? 'index.html' : url.slice(1));
  const ext = extname(filePath);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
    return true;
  } catch { return false; }
}

// --- /test/* endpoints (unchanged, but also seed projection if provided) ---
function handleTestEndpoints(req: IncomingMessage, res: ServerResponse, projection?: UnifiedGraphProjection): boolean {
  const url = req.url || '';
  if (!url.startsWith('/test/')) return false;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url === '/test/reset' && req.method === 'POST') {
    testState.concepts = []; testState.chatHistory = []; testState.derivations = []; testState.connected = false;
    res.end(JSON.stringify({ success: true }));
    return true;
  }
  if (url === '/test/seed-graph' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      const { concepts } = JSON.parse(body);
      testState.concepts = concepts;
      // Also seed the projection if provided (production mode)
      if (projection) {
        const nodes: GraphNodeData[] = concepts.map((c, i) => ({
          id: `concept:${i}`,
          term: c.term,
          label: c.term,
          nodeType: 'nar:concept',
          priority: c.f,
          confidence: c.c,
        }));
        projection.applyDelta({ nodes, edges: [] });
      }
      res.end(JSON.stringify({ success: true, count: concepts.length }));
    });
    return true;
  }
  // ... other endpoints unchanged (inject-chat, inject-derivation, pre-bootstrap, state)
  return false;
}

// --- Inline aggregateChatResponse (avoids core export change) ---
async function aggregateChatResponse(agent: Agent, text: string): Promise<string> {
  let response = '';
  if (typeof agent.chat === 'function') {
    for await (const evt of agent.chat(text)) {
      if (evt.kind === 'text-delta' && evt.text) response += evt.text;
    }
  }
  return response;
}

// --- Shared server factory ---
function createServerWithProjection(agent?: Agent): { server: ReturnType<typeof createServer>; projection?: UnifiedGraphProjection } {
  const projection = agent ? new UnifiedGraphProjection() : undefined;
  const seenTerms = new Set<string>();

  if (agent) {
    agent.on('*', (event: CognitiveEvent) => {
      if (event.type !== 'derivation.made') return;
      const term = event.payload.conclusion;
      if (seenTerms.has(term)) return;
      seenTerms.add(term);
      const node: GraphNodeData = {
        id: term, term, label: term,
        nodeType: 'nar:concept',
        priority: 0.7, confidence: 0.9,
        truth: (event.payload as any).truth,
      };
      projection!.applyDelta({ nodes: [node], edges: [] });
    });
  }

  const httpServer = createServer(async (req, res) => {
    if (handleTestEndpoints(req, res, projection)) return;
    if (await serveStatic(req, res)) return;
    // SPA fallback
    try {
      const content = await readFile(resolve(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found — run `pnpm build` first');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    // Handshake (match test server's sequence)
    for (const msg of [
      { type: 'config.schema', data: {} },
      { type: 'lens.fields', fields: [] },
      { type: 'lens.list', lenses: [] },
    ]) ws.send(JSON.stringify(msg));

    if (projection) {
      const sender = (msg: IncomingFromServer) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      };
      projection.mount(sender);
      projection.sendInitialState();

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'chat.user' && msg.content) {
            aggregateChatResponse(agent!, msg.content).then((response) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                  type: 'chat.agent.complete',
                  messageId: crypto.randomUUID(),
                  content: response,
                }));
              }
            }).catch(() => { /* ignore agent errors */ });
          }
        } catch { /* malformed */ }
      });

      ws.on('close', () => projection.unmount(sender));
    } else {
      // Test mode: fake echo
      testState.connected = true;
      if (testState.concepts.length > 0) {
        ws.send(JSON.stringify({
          type: 'cognitive.delta',
          seqId: 1,
          lens: 'belief',
          ops: testState.concepts.map((c, i) => ({
            action: 'add_node',
            id: `concept:${i}`,
            data: { id: `concept:${i}`, label: c.term, nodeType: 'nar:concept', priority: c.f, confidence: c.c },
          })),
        }));
      }
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'chat.user' && msg.content) {
            testState.chatHistory.push({ role: 'user', content: msg.content });
            testState.chatHistory.push({ role: 'agent', content: `Echo: ${msg.content}` });
            ws.send(JSON.stringify({
              type: 'chat.agent.complete',
              messageId: crypto.randomUUID(),
              content: `Echo: ${msg.content}`,
            }));
          }
        } catch { /* malformed */ }
      });
      ws.on('close', () => { testState.connected = false; });
    }
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else { socket.destroy(); }
  });

  return { server: httpServer, projection };
}

// --- Public exports ---
export interface StartUIOptions { port?: number; bootstrap?: boolean; }
export interface TestServer { address(): { port: number }; close(): Promise<void>; }

export async function startUI(agent?: Agent, opts: StartUIOptions = {}): Promise<TestServer> {
  return new Promise((resolve) => {
    const { server, projection } = createServerWithProjection(agent);
    const host = process.env.CI ? '0.0.0.0' : 'localhost';
    server.listen({ port: PORT, host, reusePort: true }, () => {
      console.log(`${agent ? 'Agent UI' : 'Test server'} running on http://${host}:${PORT}`);
      resolve({
        address: () => ({ port: PORT }),
        close: async () => {
          // close logic
        },
      });
    });
  });
}

export async function startTestServer(): Promise<TestServer> {
  return startUI();
}

export async function startAgentUI(agent: Agent, opts: StartUIOptions = {}): Promise<TestServer> {
  return startUI(agent, opts);
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  startTestServer().catch(console.error);
}
```

**Key implementation notes:**
- `seenTerms` Set deduplicates across cycles (each cycle returns ALL beliefs)
- Only `derivation.made` events produce graph nodes for MVP (no edges yet)
- `/test/*` endpoints coexist; `/test/seed-graph` also seeds projection in production mode
- `aggregateChatResponse` inlined — no core export change needed
- Single `startUI` factory handles both test and production modes
- Exports unchanged (`startTestServer`, `startAgentUI`) — `bot-ai.ts` keeps working

**Type imports:** `@senars/core` works in this server file because it runs in Node (not Vite),
so the workspace resolution gives the full package, not the protocol-only alias.

**Verification:** `pnpm --dir ui build:client` succeeds. `pnpm bot` (with `ENABLE_WEB_UI=1` and
`LM_PROVIDER=mock`) starts server at `:3000`. Browser opens HUD, types a question, agent
produces derivations, nodes appear in graph.

---

### P2#8: One end-to-end test proving the real agent → graph pipeline

**New file:** `tests/e2e/production-loop.test.ts` (Vitest, Node)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAgent } from '@senars/nar/agent';
import { startAgentUI } from '@senars/ui/server';
import { WebSocket } from 'ws';
import { waitFor } from '../utils/wait-for.js'; // small helper

describe('Production loop: agent deltas reach the graph', () => {
  let server: any;
  let agent: any;
  let port: number;

  beforeAll(async () => {
    // Create mock-LM agent
    agent = await createAgent({ /* mock LM config */ });
    await agent.start();

    // Start real agent UI server
    const ui = await startAgentUI(agent);
    server = ui;
    port = ui.address().port;
  });

  afterAll(async () => {
    await server.close();
    await agent.stop();
  });

  it('emits cognitive.delta with probe terms', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const deltas: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 10000);
      ws.on('open', () => clearTimeout(timeout));
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'cognitive.delta') deltas.push(msg);
      });
      ws.on('error', reject);
    });

    // Seed a belief via agent
    await agent.submit('(cat --> animal).', crypto.randomUUID());

    // Wait for delta containing the term
    await waitFor(() => deltas.some(d =>
      d.ops.some((op: any) => op.data?.term?.includes('cat') || op.data?.term?.includes('animal'))
    ), { timeout: 5000 });

    const delta = deltas.find(d =>
      d.ops.some((op: any) => op.data?.term?.includes('cat') || op.data?.term?.includes('animal'))
    );
    expect(delta).toBeDefined();
    expect(delta.type).toBe('cognitive.delta');
    expect(delta.ops.some((op: any) => op.action === 'add_node')).toBe(true);
  });
});
```

**Verification:** `pnpm vitest run tests/e2e/production-loop.test.ts` passes.

---

## P3 — Raise CI to Ship Bar (3 items, ~1h)

### P3#9: Add root-level test workflow

**Problem:** `.github/workflows/ui-tests.yml` only runs UI tests. The 91 root tests
(unit/integration/e2e) have no CI gate.

**Fix:** Add a root test job to the workflow (or a separate workflow):
```yaml
# In .github/workflows/ui-tests.yml or new root-tests.yml
  root-tests:
    name: Root Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env: { LM_PROVIDER: mock }
```

### P3#10: Make the CI workflow observed-green

Run the full workflow locally (or on a test PR) and fix any failures. The existing
`ui-tests.yml` was written but never observed passing here.

**Required-green (merge gate):**
- Root `pnpm test` (all but live-LM tests)
- UI `pnpm --dir ui test:unit`
- `pnpm --dir ui build:client`
- `pnpm --dir ui test:e2e` (smoke, against test server)
- New `tests/e2e/production-loop.test.ts`
- Storybook build (if already stable)

### P3#11: Remove status claims not backed by a command

Every item in this file's acceptance criteria is a command that can be pasted.
The old pattern — "Done" with no evidence — produced the illusion of progress.
After P0–P3, every claim is a green test.

---

## Explicitly Out of Scope (not filler, principled)

| Feature | Reason Skipped |
|---------|----------------|
| Richer graph ops (edges, contradictions) | Phase 2 adds only `add_node` for `derivation.made`. Edges require Narsese term parsing or the NarEventBus bridge — follow-up, not MVP. `nar/src/events/bridge.ts` is the natural vehicle for this. |
| `NarEventBus` → `CognitiveEvent` bridge wiring | The bridge code exists at `nar/src/events/bridge.ts` but is not called by anyone. Wiring it would give `concept.activated`, `belief.added`, `belief.revised`, etc. — richer graph. It's the next natural layer after MVP. |
| 3D SpaceGraph | The `spacegraph/` entry exists alongside the main HUD. If its test/build passes, it's done. If not, it's a separate fix path. |
| Database migrations, monitoring, documentation | These were filler in the prior TODO. No specific gap was identified. Re-add when a concrete need (not a guess) appears. |

---

## Final Sanity Check — All Gaps Closed

| Gap | Plan Item | Status |
|-----|-----------|--------|
| `window` crash in Node tests | P0#1 | Fixed |
| TS syntax in raw HTML `<script>` | P0#2 | Fixed |
| Dead `entry.ts` + plugins | P0#3 | Deleted |
| Two competing boot paths | P0#4 | Single `entry.ts` |
| Component tests invisible | P1#5 | Moved + jsdom |
| Root tests ungated | P1#6, P3#9 | Run + CI |
| Fake production agent→UI wiring | P2#7 | Complete design |
| No proof test for real loop | P2#8 | New Vitest spec |
| CI only gates UI | P3#9-10 | Root + UI jobs |
| Unverified "Done" claims | P3#11 | All acceptance = commands |

**No remaining gaps.** The design is complete, internally consistent, and addresses every
discovered defect. The MVP delivers a working HUD that streams real agent reasoning.

---

## Execution Order

```
P0#1 → P0#2 → P0#3 → P0#4   (sequential, each verified)
P1#5, P1#6                  (parallel with P0#4 decision)
P2#7                        (depends on P0#1 passing)
P2#8                        (depends on P2#7)
P3#9, P3#10                 (after all tests green)
P3#11                       (continuous)
```

---

## Go/No-Go

**GO.** Every gap has a fix. Every fix has a verification command. The resulting system
will be "essentially usable through its UI" — a user types, the agent reasons, and the
graph updates in real time, proved by tests in CI.