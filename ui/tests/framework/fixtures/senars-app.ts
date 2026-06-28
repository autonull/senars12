import { test as base, request } from '@playwright/test';
import { TestControl } from '../utils/test-control';
import { ErrorMonitor } from './error-monitor';
import { PerfMonitor } from '../utils/perf';
import { TestApiClient } from '../utils/test-api';
import { ChatConsole } from '../components/chat.console';
import { ConfigDrawer } from '../components/config.drawer';
import { BeliefGraph } from '../components/belief.graph';
import { TelemetryPanel } from '../components/telemetry.panel';

type SenarsFixtures = {
  testControl: TestControl;
  testApi: TestApiClient;
  errorMonitor: ErrorMonitor;
  perfMonitor: PerfMonitor;
  chat: ChatConsole;
  config: ConfigDrawer;
  graph: BeliefGraph;
  telemetry: TelemetryPanel;
};

export const test = base.extend<SenarsFixtures>({
  testControl: async ({}, use) => {
    const context = await request.newContext();
    const control = new TestControl(context);
    await control.reset();
    await use(control);
    await context.dispose();
  },

  testApi: async ({ page }, use) => {
    await page.goto('/');
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
