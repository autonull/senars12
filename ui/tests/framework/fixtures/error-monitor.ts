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
    const rejections = await this.page.evaluate(() => (window as any).__unhandledRejections || []);
    this.unhandledRejections.push(...rejections);

    const allErrors: Array<{ type: string; message: string; stack?: string }> = [
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
