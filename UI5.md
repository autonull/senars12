# UI Test Framework Implementation Status

## Progress Made

### Completed Infrastructure
1. **Component Objects** - All 4 component classes implemented in `ui/tests/framework/components/`:
   - `chat.console.ts` - Wraps chat UI interactions
   - `belief.graph.ts` - Wraps graph operations via `__testApi__`
   - `config.drawer.ts` - Wraps config UI interactions
   - `telemetry.panel.ts` - Wraps telemetry canvas access

2. **Core Fixtures** - All fixtures implemented:
   - `ws-interceptor.ts` - Uses Playwright's `routeWebSocket` API (now deprecated - see below)
   - `error-monitor.ts` - Monitors page errors, console errors, unhandled rejections
   - `senars-app.ts` - Main test.extend() with all fixtures
   - `perf.ts` - Frame time and DOM node leak monitoring

3. **Scenario Building Blocks** - Helper functions implemented:
   - `conversation.ts` - `sendAndReceiveMessage`, `establishConversation`
   - `reasoning.ts` - `seedGraph`, `triggerDerivation`, `simulateHighThroughput`
   - `network.ts` - `simulateNetworkDrop`, `waitForReconnection`

4. **Test Files** - All 14 test specs created in `ui/tests/scenarios/`:
   - `smoke/app-loads.spec.ts` - Basic smoke test
   - `conversations/first-message.spec.ts`, `markdown-rendering.spec.ts`, `streaming-response.spec.ts`
   - `configuration/switch-llm-provider.spec.ts`, `adjust-parameters.spec.ts`
   - `cognitive/graph-updates.spec.ts`, `focus-concept.spec.ts`, `high-throughput.spec.ts`
   - `resilience/network-drop.spec.ts`, `backpressure.spec.ts`, `long-session.spec.ts`
   - `security/xss-protection.spec.ts` - **PASSING**
   - `accessibility/keyboard-navigation.spec.ts`

5. **Client Component Updates** - `__testApi__` exposure added to:
   - `chat-console.ts` - messages, streamingDelta
   - `belief-graph.ts` - getNodeCount, getEdgeCount, getNodeData, clickNode, getAllNodeIds
   - `config-drawer.ts` - getConfig
   - `working-memory.ts` - getTerms
   - `store.ts` - exposeTestApi() function for store and connection state

### Pivot: Test Control REST API (In Progress)
Implementing Cypress-style `cy.task()` pattern for test control:

1. **Test Control API** (`ui/src/server/test-control.ts`) - Created
   - `POST /test/seed-graph` - Populate NARS with known concepts
   - `POST /test/inject-chat` - Queue deterministic chat responses  
   - `POST /test/inject-derivation` - Fire NARS derivation events
   - `GET /test/state` - Get current system state
   - `POST /test/reset` - Reset NARS to clean state
   - Only active when `NODE_ENV=test`

2. **Gateway Integration** (`ui/src/server/gateway.ts`) - Updated
   - Added `setPendingChatResponse()` to queue chat responses
   - Added `consumePendingChatResponse()` to retrieve in `onChat()`

3. **Test Control Client** (`ui/tests/framework/utils/test-control.ts`) - Created
   - Uses Playwright's `request` API for REST calls to server
   - Target port 3000 (same as Fastify server)

4. **Fixtures Updated** (`ui/tests/framework/fixtures/senars-app.ts`)
   - Replaced `ws` (WsInterceptor) with `testControl` (TestControl)
   - Calls `testControl.reset()` before tests
   - Uses `request.newContext()` for REST API calls

5. **Scenario Functions Updated**:
   - `conversation.ts` - Uses `testControl.injectChatResponse()` instead of interceptor
   - `reasoning.ts` - Uses `testControl.seedGraph()` and `testControl.injectDerivation()`
   - `network.ts` - Simplified to use `page.route()` for network simulation

6. **All Test Files Updated** - Replaced `ws` fixture with `testControl`:
   - `first-message.spec.ts`, `streaming-response.spec.ts`, `markdown-rendering.spec.ts`
   - `adjust-parameters.spec.ts`, `switch-llm-provider.spec.ts`
   - `graph-updates.spec.ts`, `focus-concept.spec.ts`
   - `backpressure.spec.ts`, `long-session.spec.ts`
   - `keyboard-navigation.spec.ts`, `xss-protection.spec.ts`

## Remaining Problems

### Problem 1: WebSocket Connection Timing
**Status:** Blocked by type mismatch in `@fastify/websocket` v11

The `fastify.get('/ws', { websocket: true }, (socket) => ...)` handler receives a socket
that doesn't match the expected `ws.WebSocket` type. The `@fastify/websocket` v11
types export `WebSocket = WebSocket.WebSocket` but runtime behavior shows `socket.send`
is not a function, indicating the handler is being called with wrong parameter.

### Problem 2: Unused wscat/websocat
The WebSocket endpoint cannot be easily tested without proper CLI tools. 
The `pnpm start:test` command builds the client and starts the server, but
the connection fails due to the type mismatch.

## Current State
- Test control REST API implemented and working (verified with curl)
- WebSocket interceptor deprecated in favor of REST control
- All test files updated to use `testControl` fixture
- Build and server startup working
- Blocked on `@fastify/websocket` type integration with `ws` library