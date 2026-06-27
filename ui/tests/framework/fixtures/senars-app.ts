import { test as base } from '@playwright/test';
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

export { expect } from '@playwright/test';
