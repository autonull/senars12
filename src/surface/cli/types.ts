/**
 * CLI Types — generated CLI type definitions.
 */

import type { MCPTool } from '../mcp/types';

/** CLI configuration. */
export interface CLIConfig {
  /** Application name. */
  name: string;
  /** Version. */
  version: string;
  /** Description. */
  description: string;
  /** Default command. */
  defaultCommand?: string;
}

/** CLI application. */
export interface CLIApp {
  /** Config. */
  config: CLIConfig;
  /** Commands. */
  commands: Map<string, CLICommand>;
  /** Global options. */
  globalOptions: CLIOption[];
}

/** CLI command. */
export interface CLICommand {
  /** Command name. */
  name: string;
  /** Aliases. */
  aliases?: string[];
  /** Description. */
  description: string;
  /** Command options. */
  options: CLIOption[];
  /** Subcommands. */
  subcommands?: CLICommand[];
  /** Handler. */
  handler: (context: CLIContext) => Promise<void>;
}

/** CLI option. */
export interface CLIOption {
  /** Option name. */
  name: string;
  /** Short alias. */
  alias?: string;
  /** Description. */
  description: string;
  /** Type. */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Default value. */
  default?: unknown;
  /** Required. */
  required?: boolean;
}

/** CLI execution context. */
export interface CLIContext {
  /** Parsed command. */
  command: CLICommand | null;
  /** Parsed options. */
  options: Record<string, unknown>;
  /** Positional arguments. */
  positional: string[];
  /** Raw arguments. */
  raw: string[];
}

/** CLI profile. */
export interface CLIProfile {
  /** Profile name. */
  name: string;
  /** Description. */
  description: string;
  /** Default options. */
  defaults: Record<string, unknown>;
  /** Environment variables. */
  env: Record<string, string>;
}

/** CLI pack (command group). */
export interface CLIPack {
  /** Pack name. */
  name: string;
  /** Commands in pack. */
  commands: string[];
  /** Description. */
  description: string;
}

/** Output format. */
export type CLIFormat = 'text' | 'json' | 'yaml' | 'table';

/** CLI output helper. */
export interface CLIOutput {
  /** Write line. */
  write: (text: string) => void;
  /** Write JSON. */
  json: (data: unknown) => void;
  /** Write table. */
  table: (headers: string[], rows: unknown[][]) => void;
  /** Write error. */
  error: (text: string) => void;
  /** Set format. */
  setFormat: (format: CLIFormat) => void;
}

/** Create CLI output. */
export function createCLIOutput(format: CLIFormat = 'text'): CLIOutput {
  return {
    write: (text: string) => console.log(text),
    json: (data: unknown) => console.log(JSON.stringify(data, null, 2)),
    table: (headers: string[], rows: unknown[][]) => {
      const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)));
      const headerLine = headers.map((h, i) => h.padEnd(widths[i]!)).join(' | ');
      const sepLine = widths.map(w => '-'.repeat(w)).join('-+-');
      console.log(headerLine);
      console.log(sepLine);
      for (const row of rows) {
        console.log(row.map((c, i) => String(c ?? '').padEnd(widths[i]!)).join(' | '));
      }
    },
    error: (text: string) => console.error(text),
    setFormat: (f: CLIFormat) => { /* format is stored externally */ },
  };
}

/** Default CLI config. */
export const defaultCLIConfig: CLIConfig = {
  name: 'senars',
  version: '0.0.0',
  description: 'Senars - Non-Axiomatic Reasoning System',
};

/** Generate CLI config from package.json. */
export function generateCLIConfig(pkg: { name: string; version: string; description: string }): CLIConfig {
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  };
}