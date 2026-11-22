/**
 * CLI Profiles — named configurations for different use cases.
 */

import type { CLIProfile, CLIConfig } from './types';

/** Profile manager. */
export class ProfileManager {
  private profiles: Map<string, CLIProfile> = new Map();
  private activeProfile: string | null = null;

  /** Register a profile. */
  register(profile: CLIProfile): void {
    this.profiles.set(profile.name, profile);
  }

  /** Get profile by name. */
  get(name: string): CLIProfile | undefined {
    return this.profiles.get(name);
  }

  /** Get active profile. */
  getActive(): CLIProfile | null {
    if (!this.activeProfile) return null;
    return this.profiles.get(this.activeProfile) ?? null;
  }

  /** Set active profile. */
  setActive(name: string): boolean {
    if (!this.profiles.has(name)) return false;
    this.activeProfile = name;
    return true;
  }

  /** List all profiles. */
  list(): CLIProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Apply profile to config. */
  applyProfile(config: CLIConfig, profileName: string): CLIConfig {
    const profile = this.profiles.get(profileName);
    if (!profile) return config;

    return {
      ...config,
      ...profile.defaults,
    };
  }

  /** Merge profiles (later overrides earlier). */
  mergeProfiles(...names: string[]): Partial<CLIConfig> {
    const merged: Partial<CLIConfig> = {};
    for (const name of names) {
      const profile = this.profiles.get(name);
      if (profile) {
        Object.assign(merged, profile.defaults);
      }
    }
    return merged;
  }
}

/** Create profile manager with defaults. */
export function createProfileManager(): ProfileManager {
  const manager = new ProfileManager();

  // Default profiles
  manager.register({
    name: 'default',
    description: 'Default configuration',
    defaults: {},
    env: {},
  });

  manager.register({
    name: 'development',
    description: 'Development profile with verbose logging',
    defaults: { verbose: true, logLevel: 'debug' },
    env: { NODE_ENV: 'development' },
  });

  manager.register({
    name: 'production',
    description: 'Production profile with minimal logging',
    defaults: { verbose: false, logLevel: 'warn' },
    env: { NODE_ENV: 'production' },
  });

  manager.register({
    name: 'benchmark',
    description: 'Benchmark profile with performance settings',
    defaults: { benchmark: true, sampleSize: 1000 },
    env: {},
  });

  manager.register({
    name: 'mcp',
    description: 'MCP server profile',
    defaults: { transport: 'stdio', protocol: '2026-07-28' },
    env: {},
  });

  return manager;
}

/** Generate profile from config. */
export function generateProfile(config: CLIConfig, name: string, description: string): CLIProfile {
  return {
    name,
    description,
    defaults: { ...config },
    env: {},
  };
}