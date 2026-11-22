import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolveAliases } from '../vite.aliases';

const config: StorybookConfig = {
  stories: ['../src/client/**/*.stories.@(ts|tsx)'],
  // Storybook 10 folded essentials and interactions into core; only the
  // still-separate links addon remains.
  addons: ['@storybook/addon-links'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../dist/client'],
  viteFinal: async (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: resolveAliases },
  }),
};

export default config;
