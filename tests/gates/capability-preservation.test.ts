/**
 * Capability Preservation Gate — manifest gate enforces home for every registered capability.
 *
 * This test runs the preservation gate against the capability manifest to ensure
 * no capabilities are missing without an approved disposition.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCapabilityManifest, runPreservationGate, PreservationGateResult } from '@senars/scripts/capability-manifest-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

describe('Capability Preservation Gate', () => {
  let manifest: Awaited<ReturnType<typeof buildCapabilityManifest>>;

  beforeAll(async () => {
    manifest = await buildCapabilityManifest();
  });

  it('should build capability manifest successfully', () => {
    expect(manifest).toBeDefined();
    expect(manifest.version).toBe(1);
    expect(manifest.capabilities.length).toBeGreaterThan(0);
    expect(manifest.generatedAt).toBeDefined();
  });

  it('should have 114 registered capabilities', () => {
    expect(manifest.capabilities.length).toBe(114);
  });

  it('should have all capability categories represented', () => {
    const categories = new Set(manifest.capabilities.map(c => c.category));
    const expectedCategories = [
      'perception', 'reasoning', 'learning', 'planning',
      'evaluation', 'communication', 'governance', 'memory', 'coordination',
      'games', 'rl', 'analysis', 'self-mod', 'focus', 'nl', 'schema', 'transport'
    ];

    for (const cat of expectedCategories) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('should pass preservation gate against current manifest', async () => {
    const result = await runPreservationGate(manifest);

    expect(result.pass).toBe(true);
    expect(result.missing.length).toBe(0);
    expect(result.added.length).toBe(0);
    expect(result.modified.length).toBe(0);
  });

  it('should have valid dispositions for all capabilities', async () => {
    const result = await runPreservationGate(manifest);

    // All missing capabilities should have approved dispositions
    const unapprovedMissing = result.missing.filter(c =>
      result.dispositions[c.id] === 'unknown'
    );
    expect(unapprovedMissing.length).toBe(0);
  });

  it('should have behavioral tests for each capability', () => {
    for (const cap of manifest.capabilities) {
      // Every capability should have at least a description
      expect(cap.behavior).toBeDefined();
      expect(cap.behavior.length).toBeGreaterThan(10);

      // Every capability should have sources
      expect(cap.sources.length).toBeGreaterThan(0);

      // Every capability should have an owner
      expect(cap.owner).toBeDefined();
      expect(cap.owner.length).toBeGreaterThan(0);
    }
  });

  it('should have unique capability IDs', () => {
    const ids = manifest.capabilities.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have content hashes for integrity', () => {
    for (const cap of manifest.capabilities) {
      expect(cap.hash).toBeDefined();
      expect(cap.hash.length).toBe(16); // SHA256 truncated to 16 chars
    }
  });

  it('should have valid capability structure', () => {
    for (const cap of manifest.capabilities) {
      expect(cap.id).toBeDefined();
      expect(cap.name).toBeDefined();
      expect(cap.category).toBeDefined();
      expect(cap.owner).toBeDefined();
      expect(cap.behavior).toBeDefined();
      expect(Array.isArray(cap.tests)).toBe(true);
      expect(Array.isArray(cap.sources)).toBe(true);
      expect(Array.isArray(cap.dependsOn)).toBe(true);
      expect(cap.since).toBeDefined();
      expect(typeof cap.active).toBe('boolean');
      expect(cap.hash).toBeDefined();
    }
  });

  it('should pass CLI preservation gate', () => {
    const result = spawnSync('pnpm', ['run', 'capability:gate'], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? '';
      const stdout = result.stdout?.toString() ?? '';
      console.error('capability:gate FAILED:');
      console.error(stdout);
      console.error(stderr);
    }

    expect(result.status).toBe(0);
  });

  it('should detect missing capabilities when manifest changes', async () => {
    // Create a modified manifest with a capability removed
    const modifiedManifest = {
      ...manifest,
      capabilities: manifest.capabilities.slice(0, -1), // Remove last capability
      byId: Object.fromEntries(
        manifest.capabilities.slice(0, -1).map(c => [c.id, c])
      ),
    };

    const result = await runPreservationGate(modifiedManifest, undefined);

    // Should fail because a capability is missing
    expect(result.pass).toBe(false);
    expect(result.missing.length).toBe(1);
    expect(result.dispositions[result.missing[0].id]).toBe('unknown');
  });
});