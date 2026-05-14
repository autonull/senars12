/**
 * Phase 9: Agent & Embodiment - Feature Test
 * Tests all Phase 9 implementations
 */

import {Agent} from './Agent.js';
import {HTTPServer} from './http-server.js';
import {WebSocketServer as WebSocketEmbodiment} from './websocket-server.js';
import {SeNARSFactory} from '../nar';

async function testAgentProfile(): Promise<void> {
    console.log('Testing Agent Profile & Capabilities...');

    const nar = SeNARSFactory.createDefault();
    const agent = new Agent(nar);

    agent.setProfile({
        id: 'test-profile',
        name: 'Test Agent',
        description: 'A test agent profile',
        config: {verbose: true},
        capabilities: ['reasoning', 'learning']
    });

    const profile = agent.getProfile();
    console.log('✓ Profile set and retrieved:', profile?.name);

    const capabilities = agent.getCapabilities();
    console.log('✓ Capabilities:', JSON.stringify(capabilities, null, 2));

    const description = agent.getSelfDescription();
    console.log('✓ Self Description:\n', description);
}

async function testAgentPersistence(): Promise<void> {
    console.log('\nTesting Agent Persistence...');

    const nar = SeNARSFactory.createDefault();
    const agent = new Agent(nar);

    await nar.input('(cat --> animal).');
    await nar.input('(dog --> animal).');

    const state = await nar.getMemoryState();
    console.log('✓ Memory state captured:', Object.keys(state).join(', '));

    await agent.saveState('/tmp/test-agent-state.json');
    console.log('✓ Agent state saved');

    const nar2 = SeNARSFactory.createDefault();
    const agent2 = new Agent(nar2);
    await agent2.loadState('/tmp/test-agent-state.json');
    console.log('✓ Agent state loaded');
}

async function testHTTPServer(): Promise<void> {
    console.log('\nTesting HTTP Server...');

    const nar = SeNARSFactory.createDefault();
    const agent = new Agent(nar);

    const apiKey = 'test-api-key-123';
    const httpServer = new HTTPServer({
        port: 8081,
        apiKey,
        rateLimit: {windowMs: 1000, maxRequests: 10}
    });

    const openapi = httpServer.getOpenAPISpec();
    console.log('✓ OpenAPI spec generated:', openapi.openapi);
    console.log('✓ API paths:', Object.keys(openapi.paths as any).join(', '));

    await httpServer.start(agent);
    console.log('✓ HTTP server started on port 8081');

    await new Promise(resolve => setTimeout(resolve, 1000));

    await httpServer.stop();
    console.log('✓ HTTP server stopped');
}

async function testWebSocket(): Promise<void> {
    console.log('\nTesting WebSocket Server...');

    const nar = SeNARSFactory.createDefault();
    const agent = new Agent(nar);

  const wsEmbodiment = new WebSocketEmbodiment({ port: 8766 });

  await wsEmbodiment.start(agent);
    console.log('✓ WebSocket server started on port 8766');

    const clientCount = wsEmbodiment.getConnectedClients();
    console.log('✓ Connected clients:', clientCount);

    await wsEmbodiment.stop();
    console.log('✓ WebSocket server stopped');
}

async function testHTTPAuthentication(): Promise<void> {
    console.log('\nTesting HTTP Authentication...');

    const nar = SeNARSFactory.createDefault();
    const agent = new Agent(nar);

    const apiKey = 'secure-test-key';
    const httpServer = new HTTPServer({
        port: 8082,
        apiKey,
        rateLimit: {windowMs: 1000, maxRequests: 100}
    });

    httpServer.addApiKey('another-key');
    console.log('✓ Additional API key added');

    httpServer.removeApiKey('another-key');
    console.log('✓ API key removed');

    await httpServer.start(agent);
    console.log('✓ HTTP server with auth started');

    await httpServer.stop();
    console.log('✓ HTTP server stopped');
}

async function main(): Promise<void> {
    console.log('=== Phase 9: Agent & Embodiment Tests ===\n');

    try {
        await testAgentProfile();
        await testAgentPersistence();
        await testHTTPServer();
        await testWebSocket();
        await testHTTPAuthentication();

        console.log('\n=== All Phase 9 Tests Passed ===');
    } catch (error) {
        console.error('\nTest failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
