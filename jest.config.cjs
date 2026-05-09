module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\.js$': '$1',
        '^ollama$': '<rootDir>/src/nar/lm/__mocks__/ollama.mock.ts'
    },
    transform: {
        '^.+\.tsx?$': ['ts-jest', {useESM: true}]
    },
    testMatch: ['**/tests/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    transformIgnorePatterns: ['/node_modules/']
};