const baseConfig = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    moduleNameMapper: {
        '^@senars/metta$': '<rootDir>/metta/src/index.js',
        '^@senars/metta/src/(.*)$': '<rootDir>/metta/src/$1',
        '^@senars/metta/(.*)$': '<rootDir>/metta/src/$1',
        '^@senars/tensor$': '<rootDir>/tensor/src/index.js',
        '^@senars/tensor/src/(.*)$': '<rootDir>/tensor/src/$1',
        '^@senars/tensor/(.*)$': '<rootDir>/tensor/src/$1',
        '^@senars/core$': '<rootDir>/core/src/index.js',
        '^@senars/core/src/(.*)$': '<rootDir>/core/src/$1',
        '^@senars/core/(.*)$': '<rootDir>/core/src/$1',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(?:\.pnpm|@noble|@mlc-ai|@modelcontextprotocol|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill|uuid|langsmith|nostr-tools|@langchain|@huggingface)/)',
    ],
    testTimeout: 10000,
    forceExit: true,
};

export default baseConfig;
