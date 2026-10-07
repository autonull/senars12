import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * Visual-regression config: one deterministic capture per matrix cell, committed
 * baselines under `tests/visual/baselines/<project>/`. Separate from the
 * behavioural E2E config so `test:e2e` stays fast and `test:visual` owns its
 * snapshot contract. Serial (one shared server) because a cell loads a scenario.
 */
export default defineConfig({
  testDir: '.',
  outputDir: './.artifacts',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}-{platform}{ext}',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: [['./reporter.ts'], ['list']],

  webServer: {
    command: 'NODE_NO_WARNINGS=1 tsx scripts/agent-server.ts 3456',
    port: 3456,
    reuseExistingServer: true,
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30000,
  },

  use: {
    baseURL: 'http://localhost:3456',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],

  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },

  timeout: 60000,
});
