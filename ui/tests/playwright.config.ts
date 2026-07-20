import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './scenarios',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

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
    baseURL: process.env.TEST_URL || 'http://localhost:3456',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: isCI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],

  timeout: 30000,
  expect: { timeout: 15000 },
});
