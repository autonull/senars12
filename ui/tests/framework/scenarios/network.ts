import { expect, Page } from '@playwright/test';
import { TestApiClient } from '../utils/test-api';

export async function simulateNetworkDrop(page: Page, durationMs: number) {
  await page.route('**/ws', async route => {
    await new Promise(resolve => setTimeout(resolve, durationMs));
    await route.abort();
  });
}

export async function waitForReconnection(testApi: TestApiClient, timeout = 10000) {
  await expect(async () => {
    const state = await testApi.getConnectionState();
    expect(state).toBe('connected');
  }).toPass({ timeout });
}
