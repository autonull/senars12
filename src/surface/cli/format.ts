/**
 * CLI Format — output formatting for CLI.
 */

import type { CLIFormat, CLIOutput } from './types';

/** Format manager. */
export class FormatManager {
  private format: CLIFormat = 'text';
  private output: CLIOutput;

  constructor(output: CLIOutput) {
    this.output = output;
  }

  /** Get current format. */
  getFormat(): CLIFormat {
    return this.format;
  }

  /** Set format. */
  setFormat(format: CLIFormat): void {
    this.format = format;
    this.output.setFormat(format);
  }

  /** Write data in current format. */
  write(data: unknown): void {
    switch (this.format) {
      case 'json':
        this.output.json(data);
        break;
      case 'yaml':
        this.output.write(this.toYAML(data));
        break;
      case 'table':
        this.output.table(...this.toTable(data));
        break;
      default:
        this.output.write(this.toText(data));
    }
  }

  /** Convert to text. */
  private toText(data: unknown): string {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.map(d => this.toText(d)).join('\n');
    if (typeof data === 'object') return JSON.stringify(data, null, 2);
    return String(data);
  }

  /** Convert to YAML (simplified). */
  private toYAML(data: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent);
    if (data === null) return `${spaces}null`;
    if (data === undefined) return '';
    if (typeof data === 'string') return `${spaces}${data}`;
    if (typeof data === 'number' || typeof data === 'boolean') return `${spaces}${data}`;
    if (Array.isArray(data)) {
      return data.map(item => `${spaces}- ${this.toYAML(item, 0).trim()}`).join('\n');
    }
    if (typeof data === 'object') {
      return Object.entries(data as Record<string, unknown>)
        .map(([key, value]) => `${spaces}${key}: ${this.toYAML(value, indent + 1).trim()}`)
        .join('\n');
    }
    return `${spaces}${String(data)}`;
  }

  /** Convert to table. */
  private toTable(data: unknown): [string[], unknown[][]] {
    if (!Array.isArray(data) || data.length === 0) {
      return [[], []];
    }

    const first = data[0];
    if (typeof first !== 'object' || first === null) {
      return [['value'], data.map(d => [d])];
    }

    const headers = Object.keys(first as object);
    const rows = data.map(item => {
      const obj = item as Record<string, unknown>;
      return headers.map(h => obj[h] ?? '');
    });

    return [headers, rows];
  }
}

/** Create format manager. */
export function createFormatManager(output: CLIOutput): FormatManager {
  return new FormatManager(output);
}

/** Color codes for terminal output. */
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

/** Colorize text. */
export function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/** Progress bar. */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number;
  private label: string;

  constructor(total: number, width = 40, label = '') {
    this.total = total;
    this.width = width;
    this.label = label;
  }

  /** Increment progress. */
  tick(increment = 1): void {
    this.current = Math.min(this.current + increment, this.total);
    this.render();
  }

  /** Render progress bar. */
  private render(): void {
    const percent = this.total > 0 ? this.current / this.total : 0;
    const filled = Math.round(this.width * percent);
    const empty = this.width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentStr = (percent * 100).toFixed(1).padStart(5);
    process.stdout.write(`\r${this.label} [${bar}] ${percentStr}%`);
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  /** Finish progress bar. */
  finish(): void {
    this.current = this.total;
    this.render();
  }
}

/** Spinner for indeterminate progress. */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: ReturnType<typeof setInterval> | null = null;
  private current = 0;
  private label: string;

  constructor(label = '') {
    this.label = label;
  }

  /** Start spinner. */
  start(): void {
    this.interval = setInterval(() => {
      this.current = (this.current + 1) % this.frames.length;
      process.stdout.write(`\r${this.frames[this.current]} ${this.label}`);
    }, 80);
  }

  /** Stop spinner. */
  stop(success = true): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    const icon = success ? '✓' : '✗';
    process.stdout.write(`\r${icon} ${this.label}\n`);
  }
}