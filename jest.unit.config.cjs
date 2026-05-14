module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^(\\.{1,2}/.*)\\.mjs$': '$1',
        '^(\\.{1,2}/.*)\\.cjs$': '$1',
        '^(\.{1,2}/.*)$': '$1'
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {useESM: true}]
    },
    testMatch: ['**/tests/unit/**/*.test.ts'],
    testTimeout: 10000,
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    forceExit: true,
    detectOpenHandles: false
};