/** @type {import('jest').Config} */
import baseConfig from './tests/config/base.config.js';

export default {
  ...baseConfig,
  roots: ['<rootDir>/tests/unit', '<rootDir>/metta/tests'],
  setupFiles: ['<rootDir>/tests/setup/browser-mocks.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.js'],
  testMatch: ['**/tests/unit/**/*.test.js', '**/metta/tests/**/*.test.js'],
  testTimeout: 1000,
  testPathIgnorePatterns: [
    '<rootDir>/tests/unit/.*performance.*',
    '<rootDir>/tests/unit/.*benchmark.*',
  ],
};
