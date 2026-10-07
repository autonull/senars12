import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolveAliases } from '../vite.aliases.js';

const config: StorybookConfig = {
  stories: ['../src/client/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
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
