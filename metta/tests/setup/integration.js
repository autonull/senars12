// Integration Test Setup
// This file sets up the environment for integration tests with real services

import {commonTestCleanup, commonTestSetup} from '../support/commonTestSetup.js';

// Use common test setup with custom globals for integration tests
commonTestSetup({
    silenceConsole: true,
    setupGlobals: true,
    customGlobals: {
        testId: undefined,
        testPort: undefined
    }
});

// Initialize any shared resources needed for integration tests
beforeAll(async () => {
    // Generate unique test ID for isolation
    global.testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    global.testPort = Math.floor(Math.random() * 1000) + 8000;
});

// Clean up resources after all tests
afterAll(async () => {
    // Clean up globals
    commonTestCleanup(['testId', 'testPort']);
});

// Reset state between tests if needed
beforeEach(() => {
});

afterEach(() => {
});
