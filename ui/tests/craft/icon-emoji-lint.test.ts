import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';
import { resolve } from 'node:path';

const COMPONENTS_DIR = resolve('./src/client/components');
const PRIMITIVES_DIR = resolve('./src/client/components/primitives');
const OVERLAYS_DIR = resolve('./src/client/components/overlays');
const VIEWS_DIR = resolve('./src/client/components/views');
const RENDERERS_DIR = resolve('./src/client/components/renderers');

/** Matches any emoji character (extended pictographic) */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu;

/** Allowlist for emoji in specific contexts (empty states, test files, etc.) */
const EMOJI_ALLOWLIST = new Set<string>([
  // Empty state art is allowed to have emoji
  'empty-state.ts',
  'empty-state.stories.ts',
  // Test files can have emoji for readability
]);

function findComponentFiles(): string[] {
  const dirs = [COMPONENTS_DIR, PRIMITIVES_DIR, OVERLAYS_DIR, VIEWS_DIR, RENDERERS_DIR];
  const files: string[] = [];

  for (const dir of dirs) {
    const tsFiles = glob.sync(`${dir}/**/*.ts`, { absolute: true });
    files.push(...tsFiles.filter((f) => !f.includes('.test.ts') && !f.includes('.stories.ts')));
  }

  return files;
}

describe('craft: icon/emoji lint', () => {
  const componentFiles = findComponentFiles();

  it('no emoji in chrome component source files', () => {
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf-8');
      const relPath = file.replace(resolve('.') + '/', '');

      // Skip allowlisted files
      const fileName = relPath.split('/').pop() || '';
      if (EMOJI_ALLOWLIST.has(fileName)) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.match(EMOJI_REGEX);
        if (matches) {
          violations.push({ file: relPath, line: i + 1, content: line.trim() });
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `${v.file}:${v.line} - ${v.content}`)
        .join('\n');
      throw new Error(`Emoji found in chrome components:\n${details}\n\nUse <s-icon> from the icon registry instead.`);
    }
  });

  it('icon registry has all required icons for chrome', async () => {
    // This test ensures the icon registry is the single source of truth
    const { ICONS } = await import('../../src/client/utils/icon-registry.js');
    const iconNames = Object.keys(ICONS);

    // Core chrome icons that should exist
    const requiredIcons = [
      'settings',
      'palette',
      'controlMode',
      'abort',
      'globe',
      'history',
      'zoomIn',
      'zoomOut',
      'fit',
      'minimap',
      'view3d',
      'table',
      'focus',
      'hide',
      'clear',
      'connected',
      'disconnected',
      'connecting',
      'standalone',
      'send',
      'close',
      'chevronDown',
      'chevronUp',
      'lens',
      'plus',
      'minus',
      'check',
      'more',
      'search',
      'warning',
      'contradiction',
      'brain',
      'chat',
      'closeX',
      'trash',
      'rotate',
      'sync',
      'desktop',
      'warningTriangle',
      'lightning',
      'map',
      'globeWeb',
      'play',
      'pause',
      'minimize',
      'maximize',
      'pin',
      'help',
      'tool',
      'notebook',
      'menu',
      'chart',
      'settingsGear',
    ];

    for (const required of requiredIcons) {
      expect(iconNames).toContain(required);
    }
  });
});