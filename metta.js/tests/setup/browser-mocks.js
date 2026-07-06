// Browser API Mocks
// This file mocks browser APIs that are not available in Node.js environment
// It's loaded BEFORE test files via setupFiles in Jest config

// Mock window object with URL
global.window = global.window || {
    URL: {
        createObjectURL: function () {
            return 'mock-url';
        },
        revokeObjectURL: function () {
        }
    },
    document: {},
    navigator: {
        hardwareConcurrency: 4
    }
};

// Ensure URL is available on both window and global
global.URL = global.URL || {
    createObjectURL: function () {
        return 'mock-url';
    },
    revokeObjectURL: function () {
    }
};

// Mock other browser APIs that might be needed
global.document = global.document || {};
global.navigator = global.navigator || {hardwareConcurrency: 4};

