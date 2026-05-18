import type {TUIConfig} from './visual.js';
import {buildStatusBar, type StatusBarData} from './visual.js';

/**
 * Status Bar Component for BOT4.md TUI
 * Displays persistent status information at bottom of terminal
 */
export class StatusBarComponent {
  private visible = false;
  private interval?: NodeJS.Timeout;
  
  constructor(
    private config: TUIConfig,
    private getData: () => StatusBarData
  ) {}
  
  show(): void {
    if (!this.config.statusBar || this.visible) return;
    this.visible = true;
    this.update();
  }
  
  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    // Clear the status bar line
    process.stdout.write('\r\x1b[K\n');
  }
  
  update(): void {
    if (!this.visible) return;
    const data = this.getData();
    const bar = buildStatusBar(data, this.config);
    // Write status bar at cursor position
    process.stdout.write(`\r\x1b[K${bar}\n`);
  }
  
  startAutoUpdate(intervalMs: number = 1000): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = setInterval(() => this.update(), intervalMs);
  }
  
  stopAutoUpdate(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
