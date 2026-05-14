module.exports = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.mjs$': '$1.mjs',
        '^(\\.{1,2}/.*)\\.cjs$': '$1.cjs',
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^(\\.{1,2}/.*)$': '$1'
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {useESM: true}]
    },
    testMatch: ['**/tests/**/*.test.ts'],
    testPathIgnorePatterns: [
        '/node_modules/'
    ],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    transformIgnorePatterns: ['node_modules/'],
    testTimeout: 2000,
    forceExit: true,
    detectOpenHandles: false,
    cache: true
};
