import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@senars/tools/adapters/scenario-execute': path.resolve(__dirname, '../src/tools/adapters/scenario-execute.ts'),
      '@senars/tools/adapters/scenario-profiles': path.resolve(__dirname, '../src/tools/adapters/scenario-profiles.ts'),
      '@senars/tools/adapters/self': path.resolve(__dirname, '../src/tools/adapters/self/index.ts'),
      '@senars/tools/adapters/shadow-worktree': path.resolve(__dirname, '../src/tools/adapters/shadow-worktree.ts'),
      '@senars/tools/adapters/codemod': path.resolve(__dirname, '../src/tools/adapters/codemod.ts'),
      '@senars/tools/adapters/proc': path.resolve(__dirname, '../src/tools/adapters/proc.ts'),
      '@senars/events/event-bus': path.resolve(__dirname, '../src/events/event-bus.ts'),
      '@senars/schemas/cognitive-events': path.resolve(__dirname, '../src/schemas/cognitive-events.ts'),
      '@senars/util/logger': path.resolve(__dirname, '../src/util/logger.ts'),
      '@senars/util/cli': path.resolve(__dirname, '../src/util/cli.ts'),
      '@senars/log/replay': path.resolve(__dirname, '../src/log/replay.ts'),
      '@senars/log/store': path.resolve(__dirname, '../src/log/store.ts'),
      '@senars/log/events': path.resolve(__dirname, '../src/log/events.ts'),
      '@senars/log/replay-reducers': path.resolve(__dirname, '../src/log/replay-reducers.ts'),
      '@senars/governance/artifacts': path.resolve(__dirname, '../src/governance/artifacts.ts'),
      '@senars/governance/pipeline': path.resolve(__dirname, '../src/governance/pipeline.ts'),
      '@senars/lm/system-one/manifold': path.resolve(__dirname, '../src/lm/system-one/manifold.ts'),
      '@senars/lm/system-one/open-systemone-manifold': path.resolve(__dirname, '../src/lm/system-one/open-systemone-manifold.ts'),
      '@senars/agent': path.resolve(__dirname, '../src/agent/index.ts'),
      '@senars/config': path.resolve(__dirname, '../src/config/index.ts'),
      '@senars/errors': path.resolve(__dirname, '../src/errors/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/observe/**/*.test.ts'],
    setupFiles: ['../tests/setup/vitest-setup.ts'],
    testTimeout: 15000,
  },
});