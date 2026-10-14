import { expect, type Page } from '@playwright/test';
import type { TestApiClient } from './test-api.js';

/** Poll until the client reports a live WebSocket. */
export async function waitConnected(api: TestApiClient, timeout = 10000): Promise<void> {
  await expect.poll(() => api.getConnectionState(), { timeout }).toBe('connected');
}

/** Poll until the current page reports a live WebSocket (no testApi fixture needed). */
export async function waitConnectedDirect(page: Page, timeout = 10000): Promise<void> {
  await expect.poll(async () => {
    return page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as Record<string, unknown> | undefined;
      return api?.connection?.getState?.() ?? 'disconnected';
    });
  }, { timeout }).toBe('connected');
}

/**
 * Open panels through the URL hash — the same hydration path the app uses, so
 * the spec exercises real navigation rather than poking the store.
 */
export async function openPanels(page: Page, ids: string[]): Promise<void> {
  await page.goto(`/#panels=${ids.join(',')}`);
  // A hash-only goto is a same-document navigation; reload so the boot-time
  // URL hydration actually runs.
  await page.reload();
}

/** Type a message into the composer and send it. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  const textarea = page.locator('bottom-bar textarea');
  await textarea.fill(text);
  await page.locator('bottom-bar .send-btn').click();
}

/** Switch the composer's declared intent (the mode pill in the footer). */
export async function setComposerMode(page: Page, mode: string): Promise<void> {
  await page.locator(`bottom-bar .modes button[data-mode="${mode}"]`).click();
}

/** Count of messages currently held in the chat store. */
export async function chatMessageCount(api: TestApiClient): Promise<number> {
  return JSON.parse((await api.getStoreState('chatMessages')) || '[]').length;
}