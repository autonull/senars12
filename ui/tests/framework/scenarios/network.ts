import { expect } from '@playwright/test';
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
