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
    const messages: Array<{ role: string; content: string }> = [];
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
