import type { APIRequestContext } from '@playwright/test';

export class TestControl {
  private readonly baseUrl: string;

  constructor(private context: APIRequestContext) {
    // Use TEST_URL (set by Playwright config's baseURL) or fall back to the webServer port
    this.baseUrl = process.env.TEST_SERVER_URL || process.env.TEST_URL || 'http://localhost:3456';
  }

  async seedGraph(concepts: Array<{ term: string; f: number; c: number }>) {
    const response = await this.context.post(`${this.baseUrl}/test/seed-graph`, {
      data: { concepts },
    });
    return response.json();
  }

  async injectChatResponse(stream: string, complete: string) {
    const response = await this.context.post(`${this.baseUrl}/test/inject-chat`, {
      data: { stream, complete },
    });
    return response.json();
  }

  async injectDerivation(conclusion: string, frequency = 0.85, confidence = 0.9) {
    const response = await this.context.post(`${this.baseUrl}/test/inject-derivation`, {
      data: { conclusion, frequency, confidence },
    });
    return response.json();
  }

  async getState() {
    const response = await this.context.get(`${this.baseUrl}/test/state`);
    return response.json();
  }

  async reset() {
    const response = await this.context.post(`${this.baseUrl}/test/reset`);
    return response.json();
  }

  async preBootstrap() {
    const response = await this.context.post(`${this.baseUrl}/test/pre-bootstrap`);
    return response.json();
  }
}
