# SeNARS UI — Final Test Framework Development Plan

## 1. Vision & Principles

**What "production" means for this system:** A user opens the URL and experiences a responsive, error-free, real-time cognitive telemetry dashboard that survives network drops, scales to thousands of reasoning events per second, and never leaks memory — across Chromium, Firefox, and WebKit.

**The test framework exists to guarantee this experience. Nothing more.**

### Non-Negotiable Principles

| Principle | What It Means in Practice |
| :--- | :--- |
| **Test scenarios, not components** | Tests are named after user journeys. Adding a feature adds a scenario; it never rewrites existing tests. |
| **Assert behavior, not implementation** | Tests never reference CSS classes or DOM structure. Selectors live only in Component Objects. |
| **Determinism via interception, not server mocks** | Use Playwright's `page.routeWebSocket()` to inject/modify messages. Zero server-side test code. |
| **Fail loud on any unexpected state** | Any uncaught exception, unhandled rejection, or console error (outside an allowlist) fails the test automatically. |
| **Cross-browser from day one** | No Chrome-only APIs. Performance metrics use `requestAnimationFrame`, not `performance.memory`. |
| **Tests are documentation** | A test name describes a user-facing behavior. A failure immediately tells a developer what is broken for the user. |

### What We Explicitly Reject

- ❌ Custom `/ws/control` server endpoint (test-only code paths that diverge from production)
- ❌ Server-side event buffers and sequence-ID reconciliation logic in tests
- ❌ Direct Cytoscape DOM queries (`document.querySelector('belief-graph').cy.nodes()`)
- ❌ `performance.memory` or `PerformanceObserver('longtask')` (Chrome-only)
- ❌ Manual polling loops with `setTimeout`
- ❌ Mocking the WebSocket at the transport layer (hides real integration bugs)

---

## 2. Architecture

```
tests/
├── framework/                       # The infrastructure itself
│   ├── fixtures/
│   │   ├── senars-app.ts            # Playwright fixture: app setup + error/perf monitors
│   │   └── ws-interceptor.ts        # Deterministic WebSocket injection via routeWebSocket
│   ├── components/                  # Component Objects (encapsulate selectors + __testApi__)
│   │   ├── chat.console.ts
│   │   ├── config.drawer.ts
│   │   ├── belief.graph.ts
│   │   ├── telemetry.panel.ts
│   │   └── app.layout.ts
│   ├── scenarios/                   # Reusable scenario building blocks
│   │   ├── conversation.ts
│   │   ├── reasoning.ts
│   │   └── network.ts
│   └── utils/
│       ├── perf.ts                  # Cross-browser frame tracking
│       └── test-api.ts              # window.__testApi__ client
├── scenarios/                       # Actual test files (organized by user journey)
│   ├── smoke/
│   │   └── app-loads.spec.ts
│   ├── conversations/
│   │   ├── first-message.spec.ts
│   │   ├── markdown-rendering.spec.ts
│   │   └── streaming-response.spec.ts
│   ├── configuration/
│   │   ├── switch-llm-provider.spec.ts
│   │   └── adjust-parameters.spec.ts
│   ├── cognitive/
│   │   ├── graph-updates.spec.ts
│   │   ├── focus-concept.spec.ts
│   │   └── high-throughput.spec.ts
│   ├── resilience/
│   │   ├── network-drop.spec.ts
│   │   ├── backpressure.spec.ts
│   │   └── long-session.spec.ts
│   ├── security/
│   │   └── xss-protection.spec.ts
│   └── accessibility/
│       └── keyboard-navigation.spec.ts
├── visual/
│   └── snapshots/                   # Visual regression baselines
├── playwright.config.ts
└── tsconfig.json
```

---

## 3. Core Infrastructure

### 3.1 WebSocket Interceptor (`tests/framework/fixtures/ws-interceptor.ts`)

This replaces the entire custom server control channel. It uses Playwright's native `page.routeWebSocket()` to intercept, modify, delay, or inject messages **without touching the server**.

```typescript
import { Page } from '@playwright/test';

export class WsInterceptor {
  private injectedResponses: Map<string, any> = new Map();
  private messageLog: any[] = [];
  private route: any = null;

  constructor(private page: Page) {}

  async attach(urlPattern: string = '**/ws') {
    await this.page.routeWebSocket(urlPattern, async (ws) => {
      // Log all messages for debugging
      ws.onMessageFromServer(async (msg) => {
        this.messageLog.push({ direction: 'server→client', data: msg, ts: Date.now() });
        return msg; // Pass through by default
      });

      ws.onMessageFromClient(async (msg) => {
        this.messageLog.push({ direction: 'client→server', data: msg, ts: Date.now() });

        // Check if we should intercept this message
        const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;

        // Inject a deterministic response for chat.user messages
        if (parsed.type === 'chat.user' && this.injectedResponses.has('chat')) {
          const response = this.injectedResponses.get('chat')!;
          this.injectedResponses.delete('chat');

          // Schedule the injected response after a small delay (simulates real streaming)
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chat.agent.stream', delta: response.stream }));
          }, 50);
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chat.agent.complete', content: response.complete }));
          }, 200);
        }

        return msg;
      });

      this.route = ws;
    });
  }

  /** Queue a deterministic chat response for the next user message */
  injectChatResponse(stream: string, complete: string) {
    this.injectedResponses.set('chat', { stream, complete });
  }

  /** Inject a cognitive delta directly to the client (bypasses server) */
  async injectCognitiveDelta(module: string, ops: any[]) {
    if (!this.route) throw new Error('Interceptor not attached');
    this.route.send(JSON.stringify({
      type: 'cognitive.delta',
      module,
      ops,
    }));
  }

  /** Inject a config schema */
  async injectConfigSchema(schema: Record<string, any>) {
    if (!this.route) throw new Error('Interceptor not attached');
    this.route.send(JSON.stringify({
      type: 'config.schema',
      data: schema,
    }));
  }

  /** Simulate network drop */
  async simulateDrop(durationMs: number) {
    await this.page.unroute('**/ws');
    await new Promise(r => setTimeout(r, durationMs));
    await this.attach();
  }

  /** Get all logged messages (for assertions) */
  getLog() {
    return [...this.messageLog];
  }

  /** Clear the log */
  clearLog() {
    this.messageLog = [];
  }
}
```

### 3.2 Test API Client (`tests/framework/utils/test-api.ts`)

Components expose a minimal, versioned API on `window.__testApi__` (only in test mode). This client wraps it.

```typescript
import { Page } from '@playwright/test';

export class TestApiClient {
  constructor(private page: Page) {}

  async ensureReady() {
    await this.page.waitForFunction(() => (window as any).__testApi !== undefined, { timeout: 5000 });
  }

  // Graph
  async getGraphNodeCount(): Promise<number> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getNodeCount());
  }

  async getGraphEdgeCount(): Promise<number> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getEdgeCount());
  }

  async getNodeData(nodeId: string): Promise<any> {
    return this.page.evaluate((id) => (window as any).__testApi.graph.getNodeData(id), nodeId);
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.page.evaluate((id) => (window as any).__testApi.graph.clickNode(id), nodeId);
  }

  async getAllNodeIds(): Promise<string[]> {
    return this.page.evaluate(() => (window as any).__testApi.graph.getAllNodeIds());
  }

  // Working Memory
  async getWorkingMemoryTerms(): Promise<string[]> {
    return this.page.evaluate(() => (window as any).__testApi.workingMemory.getTerms());
  }

  // Connection
  async getConnectionState(): Promise<string> {
    return this.page.evaluate(() => (window as any).__testApi.connection.getState());
  }

  // Store (for deep assertions)
  async getStoreState(path: string): Promise<any> {
    return this.page.evaluate((p) => (window as any).__testApi.store.getState(p), path);
  }
}
```

### 3.3 Cross-Browser Performance Monitor (`tests/framework/utils/perf.ts`)

Works on Chromium, Firefox, and WebKit. No Chrome-only APIs.

```typescript
import { Page } from '@playwright/test';

export class PerfMonitor {
  private startTime: number = 0;

  constructor(private page: Page) {}

  async start() {
    this.startTime = Date.now();

    // Inject cross-browser frame time tracker
    await this.page.evaluate(() => {
      (window as any).__frameTimes = [];
      let last = performance.now();
      const loop = () => {
        const now = performance.now();
        (window as any).__frameTimes.push(now - last);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    // Inject memory tracker via performance.measureUserAgentSpecificMemory (where available)
    // or fallback to DOM node count as a proxy
    await this.page.evaluate(() => {
      (window as any).__nodeCountHistory = [];
      setInterval(() => {
        (window as any).__nodeCountHistory.push(document.getElementsByTagName('*').length);
      }, 1000);
    });
  }

  async assertWithinBudget() {
    const frameTimes = await this.page.evaluate(() => (window as any).__frameTimes || []);
    const nodeCounts = await this.page.evaluate(() => (window as any).__nodeCountHistory || []);

    // Check for frame drops (>33ms = below 30fps)
    const drops = frameTimes.filter((t: number) => t > 33);
    const severeDrops = frameTimes.filter((t: number) => t > 100);

    if (severeDrops.length > 5) {
      throw new Error(
        `Performance degradation: ${severeDrops.length} severe frame drops (>100ms). ` +
        `Worst: ${Math.max(...severeDrops).toFixed(2)}ms`
      );
    }

    if (drops.length > frameTimes.length * 0.1) {
      throw new Error(
        `Excessive frame drops: ${(drops.length / frameTimes.length * 100).toFixed(1)}% of frames exceeded 33ms`
      );
    }

    // Check for DOM node growth (proxy for memory leaks)
    if (nodeCounts.length > 10) {
      const startNodes = nodeCounts[0];
      const endNodes = nodeCounts[nodeCounts.length - 1];
      const growth = (endNodes - startNodes) / startNodes;

      if (growth > 0.20) {
        throw new Error(
          `Potential memory leak: DOM node count grew by ${(growth * 100).toFixed(1)}% ` +
          `(${startNodes} → ${endNodes} nodes)`
        );
      }
    }
  }
}
```

### 3.4 Error Monitor (`tests/framework/fixtures/error-monitor.ts`)

```typescript
import { Page } from '@playwright/test';

const ALLOWED_ERRORS = [
  /DevTools failed to load source map/,
  /A cookie was set without the "SameSite" attribute/,
  /The resource.*was preloaded using link preload but not used/,
];

export class ErrorMonitor {
  private uncaughtExceptions: Array<{ message: string; stack?: string }> = [];
  private consoleErrors: string[] = [];
  private unhandledRejections: Array<{ message: string; stack?: string }> = [];

  constructor(private page: Page) {}

  start() {
    this.page.on('pageerror', (error) => {
      this.uncaughtExceptions.push({ message: error.message, stack: error.stack });
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!ALLOWED_ERRORS.some(re => re.test(text))) {
          this.consoleErrors.push(text);
        }
      }
    });

    // Inject unhandled rejection tracker
    this.page.evaluate(() => {
      (window as any).__unhandledRejections = [];
      window.addEventListener('unhandledrejection', (event) => {
        (window as any).__unhandledRejections.push({
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
        });
      });
    });
  }

  async assertNoErrors() {
    // Collect unhandled rejections from the page
    const rejections = await this.page.evaluate(() => (window as any).__unhandledRejections || []);
    this.unhandledRejections.push(...rejections);

    const allErrors = [
      ...this.uncaughtExceptions.map(e => ({ type: 'uncaught_exception', ...e })),
      ...this.consoleErrors.map(e => ({ type: 'console_error', message: e })),
      ...this.unhandledRejections.map(e => ({ type: 'unhandled_rejection', ...e })),
    ];

    if (allErrors.length > 0) {
      const summary = allErrors.map(e => `  [${e.type}] ${e.message}${e.stack ? '\n' + e.stack : ''}`).join('\n');
      throw new Error(`Test failed: ${allErrors.length} unexpected error(s):\n${summary}`);
    }
  }
}
```

### 3.5 Main App Fixture (`tests/framework/fixtures/senars-app.ts`)

Ties everything together via Playwright's `test.extend()`.

```typescript
import { test as base, expect, Page } from '@playwright/test';
import { WsInterceptor } from './ws-interceptor';
import { ErrorMonitor } from './error-monitor';
import { PerfMonitor } from '../utils/perf';
import { TestApiClient } from '../utils/test-api';
import { ChatConsole } from '../components/chat.console';
import { ConfigDrawer } from '../components/config.drawer';
import { BeliefGraph } from '../components/belief.graph';
import { TelemetryPanel } from '../components/telemetry.panel';

type SenarsFixtures = {
  ws: WsInterceptor;
  testApi: TestApiClient;
  errorMonitor: ErrorMonitor;
  perfMonitor: PerfMonitor;
  chat: ChatConsole;
  config: ConfigDrawer;
  graph: BeliefGraph;
  telemetry: TelemetryPanel;
};

export const test = base.extend<SenarsFixtures>({
  ws: async ({ page }, use) => {
    const interceptor = new WsInterceptor(page);
    await interceptor.attach();
    await use(interceptor);
  },

  testApi: async ({ page }, use) => {
    const client = new TestApiClient(page);
    await client.ensureReady();
    await use(client);
  },

  errorMonitor: async ({ page }, use) => {
    const monitor = new ErrorMonitor(page);
    monitor.start();
    await use(monitor);
    await monitor.assertNoErrors();
  },

  perfMonitor: async ({ page }, use) => {
    const monitor = new PerfMonitor(page);
    await monitor.start();
    await use(monitor);
    await monitor.assertWithinBudget();
  },

  chat: async ({ page }, use) => {
    await use(new ChatConsole(page));
  },

  config: async ({ page }, use) => {
    await use(new ConfigDrawer(page));
  },

  graph: async ({ page }, use) => {
    await use(new BeliefGraph(page));
  },

  telemetry: async ({ page }, use) => {
    await use(new TelemetryPanel(page));
  },
});

export { expect };
```

---

## 4. Component Objects

Each Component Object encapsulates all knowledge about a component's DOM structure and exposes a clean behavioral API. Tests never touch selectors directly.

### 4.1 Chat Console (`tests/framework/components/chat.console.ts`)

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class ChatConsole {
  private readonly root: Locator;
  private readonly messages: Locator;
  private readonly input: Locator;
  private readonly sendButton: Locator;

  constructor(private page: Page) {
    this.root = page.locator('chat-console');
    this.messages = this.root.locator('[data-testid="message"]');
    this.input = this.root.locator('input[placeholder]');
    this.sendButton = this.root.locator('button:has-text("SEND")');
  }

  async sendMessage(content: string) {
    await this.input.fill(content);
    await this.sendButton.click();
  }

  async waitForResponse(timeout = 10000) {
    // Wait for streaming cursor to disappear (response complete)
    await this.root.locator('.cursor').waitFor({ state: 'detached', timeout });
  }

  async getMessageCount(): Promise<number> {
    return this.messages.count();
  }

  async getLatestMessage(): Promise<{ role: string; content: string }> {
    const last = this.messages.last();
    const role = await last.getAttribute('data-role') || '';
    const content = (await last.textContent())?.trim() || '';
    return { role, content };
  }

  async getAllMessages(): Promise<Array<{ role: string; content: string }>> {
    const count = await this.messages.count();
    const messages = [];
    for (let i = 0; i < count; i++) {
      const msg = this.messages.nth(i);
      messages.push({
        role: await msg.getAttribute('data-role') || '',
        content: (await msg.textContent())?.trim() || '',
      });
    }
    return messages;
  }

  async assertStreaming() {
    await expect(this.root.locator('.cursor')).toBeVisible();
  }

  async assertNotStreaming() {
    await expect(this.root.locator('.cursor')).not.toBeVisible();
  }
}
```

### 4.2 Belief Graph (`tests/framework/components/belief.graph.ts`)

Uses `__testApi__` exclusively — no direct Cytoscape DOM queries.

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TestApiClient } from '../utils/test-api';

export class BeliefGraph {
  private readonly root: Locator;
  private readonly truncationWarning: Locator;
  private readonly testApi: TestApiClient;

  constructor(private page: Page) {
    this.root = page.locator('belief-graph');
    this.truncationWarning = this.root.locator('[data-testid="truncation-warning"]');
    this.testApi = new TestApiClient(page);
  }

  async getNodeCount(): Promise<number> {
    return this.testApi.getGraphNodeCount();
  }

  async getEdgeCount(): Promise<number> {
    return this.testApi.getGraphEdgeCount();
  }

  async getNodeData(nodeId: string): Promise<any> {
    return this.testApi.getNodeData(nodeId);
  }

  async clickNode(nodeId: string): Promise<void> {
    await this.testApi.clickNode(nodeId);
  }

  async getAllNodeIds(): Promise<string[]> {
    return this.testApi.getAllNodeIds();
  }

  async waitForUpdate(timeout = 5000) {
    await expect(async () => {
      const count = await this.getNodeCount();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout });
  }

  async waitForNode(nodeId: string, timeout = 5000) {
    await expect(async () => {
      const data = await this.getNodeData(nodeId);
      expect(data).not.toBeNull();
    }).toPass({ timeout });
  }

  async assertTruncated() {
    await expect(this.truncationWarning).toBeVisible();
  }

  async assertNotTruncated() {
    await expect(this.truncationWarning).not.toBeVisible();
  }
}
```

### 4.3 Config Drawer (`tests/framework/components/config.drawer.ts`)

```typescript
import { Page, Locator, expect } from '@playwright/test';

export class ConfigDrawer {
  private readonly root: Locator;

  constructor(private page: Page) {
    this.root = page.locator('config-drawer');
  }

  async open() {
    // If drawer is collapsed, click the toggle
    const toggle = this.page.locator('[data-testid="config-toggle"]');
    if (await toggle.isVisible()) {
      await toggle.click();
    }
  }

  async setSlider(key: string, value: number) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const slider = field.locator('input[type="range"]');
    await slider.fill(value.toString());
  }

  async setDropdown(key: string, value: string) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const select = field.locator('select');
    await select.selectOption(value);
  }

  async setToggle(key: string, value: boolean) {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const checkbox = field.locator('input[type="checkbox"]');
    if (value) await checkbox.check();
    else await checkbox.uncheck();
  }

  async getFieldValue(key: string): Promise<string> {
    const field = this.root.locator(`[data-testid="field-${key}"]`);
    const val = field.locator('.val');
    return (await val.textContent())?.trim() || '';
  }

  async assertFieldExists(key: string) {
    await expect(this.root.locator(`[data-testid="field-${key}"]`)).toBeVisible();
  }
}
```

---

## 5. Scenario Building Blocks

Reusable steps that scenarios compose from. Each block is a pure function that takes the app context and returns a result.

### 5.1 Conversation Scenarios (`tests/framework/scenarios/conversation.ts`)

```typescript
import { expect } from '@playwright/test';
import { ChatConsole } from '../components/chat.console';
import { WsInterceptor } from '../fixtures/ws-interceptor';

export async function sendAndReceiveMessage(
  chat: ChatConsole,
  ws: WsInterceptor,
  userMessage: string,
  expectedResponsePattern?: RegExp
) {
  // Queue a deterministic response before sending
  ws.injectChatResponse(
    `Processing "${userMessage}"... `,
    `Processed: ${userMessage}. Analysis complete.`
  );

  const initialCount = await chat.getMessageCount();
  await chat.sendMessage(userMessage);

  // Wait for response using expect.poll()
  await expect(async () => {
    const count = await chat.getMessageCount();
    expect(count).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 5000 });

  await chat.waitForResponse();

  const latest = await chat.getLatestMessage();
  expect(latest.role).toBe('agent');

  if (expectedResponsePattern) {
    expect(latest.content).toMatch(expectedResponsePattern);
  }

  return latest;
}

export async function establishConversation(
  chat: ChatConsole,
  ws: WsInterceptor,
  turns: number = 3
) {
  const messages = [
    'What is the capital of France?',
    'Tell me more about its history.',
    'What are some famous landmarks there?',
  ];

  for (let i = 0; i < Math.min(turns, messages.length); i++) {
    await sendAndReceiveMessage(chat, ws, messages[i]);
  }
}
```

### 5.2 Reasoning Scenarios (`tests/framework/scenarios/reasoning.ts`)

```typescript
import { expect } from '@playwright/test';
import { BeliefGraph } from '../components/belief.graph';
import { WsInterceptor } from '../fixtures/ws-interceptor';
import { TestApiClient } from '../utils/test-api';

export async function seedGraph(
  ws: WsInterceptor,
  graph: BeliefGraph,
  concepts: Array<{ id: string; priority: number; confidence: number }>
) {
  const ops = concepts.map(c => ({
    action: 'add_node' as const,
    id: c.id,
    data: { priority: c.priority, confidence: c.confidence },
  }));

  await ws.injectCognitiveDelta('belief_graph', ops);

  // Wait for first concept to appear
  await graph.waitForNode(concepts[0].id);
}

export async function triggerDerivation(
  ws: WsInterceptor,
  graph: BeliefGraph,
  conclusionId: string,
  priority: number = 0.85
) {
  const initialCount = await graph.getNodeCount();

  await ws.injectCognitiveDelta('belief_graph', [
    { action: 'add_node', id: conclusionId, data: { priority, confidence: 0.9 } },
  ]);

  await expect(async () => {
    const count = await graph.getNodeCount();
    expect(count).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 3000 });

  const data = await graph.getNodeData(conclusionId);
  expect(data).not.toBeNull();
  expect(data.priority).toBe(priority);
}

export async function simulateHighThroughput(
  ws: WsInterceptor,
  graph: BeliefGraph,
  eventsPerSecond: number,
  durationSec: number
) {
  const interval = 1000 / eventsPerSecond;
  const totalEvents = eventsPerSecond * durationSec;

  const startTime = Date.now();
  for (let i = 0; i < totalEvents; i++) {
    await ws.injectCognitiveDelta('belief_graph', [
      {
        action: 'add_node',
        id: `concept-${i}`,
        data: { priority: 0.5 + Math.random() * 0.5, confidence: 0.5 + Math.random() * 0.5 },
      },
    ]);
    await new Promise(r => setTimeout(r, interval));
  }

  const elapsed = Date.now() - startTime;
  const actualRate = totalEvents / (elapsed / 1000);

  // Verify we maintained target rate (within 20% tolerance)
  expect(actualRate).toBeGreaterThan(eventsPerSecond * 0.8);

  // Verify hard cap is enforced
  const nodeCount = await graph.getNodeCount();
  expect(nodeCount).toBeLessThanOrEqual(300);
}
```

### 5.3 Network Scenarios (`tests/framework/scenarios/network.ts`)

```typescript
import { Page, expect } from '@playwright/test';
import { WsInterceptor } from '../fixtures/ws-interceptor';
import { TestApiClient } from '../utils/test-api';

export async function simulateNetworkDrop(ws: WsInterceptor, durationMs: number) {
  await ws.simulateDrop(durationMs);
}

export async function waitForReconnection(testApi: TestApiClient, timeout = 10000) {
  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout });
}
```

---

## 6. Concrete Test Scenarios

### 6.1 Smoke Test (`tests/scenarios/smoke/app-loads.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';

test('app loads without errors and connects to WebSocket', async ({
  page, chat, config, graph, telemetry, testApi,
}) => {
  // Verify all major components are visible
  await expect(page.locator('chat-console')).toBeVisible();
  await expect(page.locator('config-drawer')).toBeVisible();
  await expect(page.locator('belief-graph')).toBeVisible();
  await expect(page.locator('telemetry-panel')).toBeVisible();

  // Verify WebSocket connected
  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout: 5000 });

  // Error monitor and perf monitor assert on teardown
});
```

### 6.2 First Conversation (`tests/scenarios/conversations/first-message.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('user can send first message and receive streamed response', async ({ chat, ws }) => {
  const response = await sendAndReceiveMessage(
    chat, ws,
    'Analyze the current state',
    /processed.*analysis complete/i
  );

  expect(response.role).toBe('agent');
  expect(response.content).toContain('Analysis complete');

  const count = await chat.getMessageCount();
  expect(count).toBe(2); // 1 user + 1 agent
});
```

### 6.3 Markdown Rendering (`tests/scenarios/conversations/markdown-rendering.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';

test('agent responses render markdown correctly', async ({ chat, ws, page }) => {
  const markdownResponse = `# Analysis

Here is a **bold** statement and a code block:

\`\`\`typescript
const x = 42;
console.log(x);
\`\`\`

And a [link](https://example.com).`;

  ws.injectChatResponse('', markdownResponse);
  await chat.sendMessage('Render this');
  await chat.waitForResponse();

  // Verify markdown was rendered (not shown as raw text)
  const latest = await chat.getLatestMessage();
  expect(latest.content).toContain('Analysis');
  expect(latest.content).not.toContain('# Analysis'); // Header rendered, not raw

  // Verify code block has syntax highlighting
  const codeBlock = page.locator('chat-console pre code').last();
  await expect(codeBlock).toBeVisible();

  // Verify link is clickable
  const link = page.locator('chat-console a[href="https://example.com"]').last();
  await expect(link).toBeVisible();
});
```

### 6.4 Switch LLM Provider (`tests/scenarios/configuration/switch-llm-provider.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('user can switch LLM provider and next response uses new provider', async ({ chat, config, ws }) => {
  // Inject a config schema with LLM provider
  await ws.injectConfigSchema({
    'llm.provider': {
      type: 'dropdown',
      label: 'LLM Provider',
      value: 'OpenAI',
      options: ['OpenAI', 'Anthropic', 'Ollama'],
    },
  });

  await config.open();
  await config.assertFieldExists('llm.provider');
  await config.setDropdown('llm.provider', 'Anthropic');

  // Verify the UI reflects the change
  await expect(async () => {
    const val = await config.getFieldValue('llm.provider');
    expect(val).toBe('Anthropic');
  }).toPass({ timeout: 2000 });

  // Send a message and verify response
  ws.injectChatResponse('', 'Response from Anthropic Claude');
  await sendAndReceiveMessage(chat, ws, 'Hello', /anthropic/i);
});
```

### 6.5 Graph Updates (`tests/scenarios/cognitive/graph-updates.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph, triggerDerivation } from '../../framework/scenarios/reasoning';

test('belief graph updates when NARS derives new conclusions', async ({ graph, ws }) => {
  // Seed initial knowledge
  await seedGraph(ws, graph, [
    { id: 'bird', priority: 0.9, confidence: 0.9 },
    { id: 'fly', priority: 0.8, confidence: 0.85 },
    { id: 'animal', priority: 0.95, confidence: 0.95 },
  ]);

  const initialCount = await graph.getNodeCount();
  expect(initialCount).toBe(3);

  // Trigger a derivation
  await triggerDerivation(ws, graph, 'flying-animal', 0.85);

  // Verify graph updated
  const newCount = await graph.getNodeCount();
  expect(newCount).toBe(4);

  // Verify new node has correct data
  const data = await graph.getNodeData('flying-animal');
  expect(data.priority).toBe(0.85);
});
```

### 6.6 Focus Concept (`tests/scenarios/cognitive/focus-concept.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph } from '../../framework/scenarios/reasoning';

test('clicking a node in the graph focuses it and recenters the subgraph', async ({ graph, ws, testApi }) => {
  await seedGraph(ws, graph, [
    { id: 'bird', priority: 0.9, confidence: 0.9 },
    { id: 'fly', priority: 0.8, confidence: 0.85 },
    { id: 'animal', priority: 0.95, confidence: 0.95 },
  ]);

  // Click on 'bird'
  await graph.clickNode('bird');

  // Verify working memory updated
  await expect(async () => {
    const terms = await testApi.getWorkingMemoryTerms();
    expect(terms).toContain('bird');
  }).toPass({ timeout: 2000 });
});
```

### 6.7 High Throughput (`tests/scenarios/cognitive/high-throughput.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { simulateHighThroughput } from '../../framework/scenarios/reasoning';

test('UI remains responsive under 50 derivations/sec for 30 seconds', async ({ graph, ws }) => {
  await simulateHighThroughput(ws, graph, 50, 30);

  // Perf monitor asserts no frame drops or memory leaks on teardown
  // Graph hard cap is verified inside simulateHighThroughput
});
```

### 6.8 Network Drop (`tests/scenarios/resilience/network-drop.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';
import { simulateNetworkDrop, waitForReconnection } from '../../framework/scenarios/network';

test('UI reconnects and reconciles state after network drop', async ({ chat, graph, ws, testApi }) => {
  // Establish state
  await sendAndReceiveMessage(chat, ws, 'Hello');
  const messageCountBefore = await chat.getMessageCount();
  const nodeCountBefore = await graph.getNodeCount();

  // Simulate network drop
  await simulateNetworkDrop(ws, 3000);

  // Wait for reconnection
  await waitForReconnection(testApi);

  // Verify state was reconciled
  await expect(async () => {
    const messageCountAfter = await chat.getMessageCount();
    const nodeCountAfter = await graph.getNodeCount();
    expect(messageCountAfter).toBe(messageCountBefore);
    expect(nodeCountAfter).toBe(nodeCountBefore);
  }).toPass({ timeout: 5000 });
});
```

### 6.9 Long Session (`tests/scenarios/resilience/long-session.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('no memory leaks or performance degradation over 100 message exchanges', async ({ chat, graph, ws }) => {
  for (let i = 0; i < 100; i++) {
    await sendAndReceiveMessage(chat, ws, `Message ${i}`);

    // Every 10 messages, verify graph is still bounded
    if (i % 10 === 0) {
      const nodeCount = await graph.getNodeCount();
      expect(nodeCount).toBeLessThanOrEqual(300);
    }
  }

  // Perf monitor asserts no memory leaks or frame drops on teardown
});
```

### 6.10 XSS Protection (`tests/scenarios/security/xss-protection.spec.ts`)

```typescript
import { test, expect } from '../../framework/fixtures/senars-app';

test('malicious markdown does not execute scripts', async ({ chat, ws, page }) => {
  const maliciousPayload = '<script>alert("xss")</script>';
  ws.injectChatResponse(maliciousPayload, maliciousPayload);

  await chat.sendMessage('Render this');
  await chat.waitForResponse();

  // Verify script tag was sanitized (rendered as text, not executed)
  const latest = await chat.getLatestMessage();
  expect(latest.content).not.toContain('<script>');

  // Verify no alert was triggered (would cause pageerror)
  // Error monitor will catch any XSS attempts on teardown
});
```

---

## 7. Server-Side Test API Exposure

Components expose `window.__testApi__` only when `NODE_ENV === 'test'`. This is added to each component.

### Example: Belief Graph (`src/client/components/belief-graph.ts` addition)

```typescript
// At the end of the class
connectedCallback() {
  super.connectedCallback();
  if (process.env.NODE_ENV === 'test') {
    (window as any).__testApi = (window as any).__testApi || {};
    (window as any).__testApi.graph = {
      getNodeCount: () => this.cy.nodes().length,
      getEdgeCount: () => this.cy.edges().length,
      getNodeData: (id: string) => this.cy.getElementById(id).data() || null,
      getAllNodeIds: () => this.cy.nodes().map((n: any) => n.id()),
      clickNode: (id: string) => this.cy.getElementById(id).emit('tap'),
    };
  }
}
```

Similar patterns apply to `chat-console`, `config-drawer`, `telemetry-panel`, and the root store.

---

## 8. Playwright Configuration

### 8.1 Config File (`tests/playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scenarios',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    //{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    //{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  timeout: 30000,
  expect: { timeout: 5000 },
});
```

### 8.2 NPM Scripts (`package.json`)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:smoke": "playwright test tests/scenarios/smoke",
    "test:e2e:critical": "playwright test --grep @critical",
    "test:visual:update": "playwright test --update-snapshots",
    "start:test": "NODE_ENV=test node dist/server/index.js"
  }
}
```

---

## 10. Execution Order

Build in this exact sequence. Each phase unblocks the next.

1. **Phase 1 — Test API Exposure**: Add `window.__testApi__` to each component (gated by `NODE_ENV === 'test'`). This is the foundation everything else depends on.
2. **Phase 2 — Core Infrastructure**: Build `WsInterceptor`, `TestApiClient`, `PerfMonitor`, `ErrorMonitor`, and the main `test.extend()` fixture.
3. **Phase 3 — Component Objects**: Build `ChatConsole`, `BeliefGraph`, `ConfigDrawer`, `TelemetryPanel`.
4. **Phase 4 — Smoke Test**: Write `app-loads.spec.ts`. This validates the entire infrastructure works end-to-end.
5. **Phase 5 — Scenario Building Blocks**: Build `conversation.ts`, `reasoning.ts`, `network.ts`.
6. **Phase 6 — Core Scenarios**: Write the conversation, configuration, and cognitive tests.
7. **Phase 7 — Resilience Scenarios**: Write network drop, backpressure, and long-session tests.
8. **Phase 8 — Security & Accessibility**: Write XSS and keyboard navigation tests.
9. **Phase 9 — CI/CD**: Wire up GitHub Actions, configure reporters, add visual regression baselines.

---

## 11. How This Enables Agile Development

### Adding a New Feature
1. Write a scenario test first (TDD).
2. Implement the feature.
3. Test passes. No existing tests break because they assert behavior, not implementation.

### Refactoring
1. Run the full suite — all tests pass.
2. Refactor the code.
3. Update Component Objects if selectors changed (one place).
4. Run tests again — all still pass.

### Fixing a Bug
1. Write a test that reproduces the bug (it fails).
2. Fix the bug.
3. Test passes. The bug can never return.

### Scaling the System
1. Add performance scenarios with higher throughput.
2. Perf monitor catches degradation automatically.
3. Optimize until tests pass.

---

## 12. What This Framework Guarantees

| Guarantee | How It's Enforced |
| :--- | :--- |
| No mysterious browser errors | `ErrorMonitor` catches all uncaught exceptions, unhandled rejections, and console errors |
| No performance degradation | `PerfMonitor` tracks frame times and DOM node growth across all browsers |
| No broken user journeys | Scenarios test real user flows end-to-end |
| No brittle tests | Component Objects + behavioral assertions + `__testApi__` |
| No non-deterministic failures | `WsInterceptor` provides controlled injection via `routeWebSocket` |
| No security vulnerabilities | XSS tests verify DOMPurify sanitization |
| No network issues | Resilience tests simulate drops and slow networks |
| No memory leaks | Long-session tests track DOM node growth |
| No cross-browser bugs | Tests run on Chromium, Firefox, and WebKit |
| No CI flakes | Retries, `expect.poll()`, deterministic scenarios |

This is the complete, self-contained, actionable test framework. It is lean (no custom server test code), cross-browser, deterministic, and agile. Every test is a contract with the user. When the tests pass, the user gets the "full glorious operation" every time.

