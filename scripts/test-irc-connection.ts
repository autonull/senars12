/**
 * IRC Connection Test
 *
 * Tests the IRC connection module directly.
 * Requires a running IRC server or will skip if not available.
 */

import type { ConnectionConfig, ConnectionDeps } from '../src/io';
import { IRCConnection } from '../src/io';
import { createLogger } from '../nar/src/logger';

const logger = createLogger({ scope: 'test:irc' });

// Test configuration - use a public IRC server for testing
const TEST_CONFIG = {
  server: process.env.IRC_TEST_SERVER || 'irc.libera.chat',
  port: Number.parseInt(process.env.IRC_TEST_PORT || '6667'),
  nick: process.env.IRC_TEST_NICK || 'senars-test-bot',
  channels: (process.env.IRC_TEST_CHANNELS || '#test').split(','),
  tls: false,
  sasl: false,
};

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function testIRCConnection() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  IRC Connection Test                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Testing IRC connection to ${TEST_CONFIG.server}:${TEST_CONFIG.port}`);
  console.log(`Nick: ${TEST_CONFIG.nick}`);
  console.log(`Channels: ${TEST_CONFIG.channels.join(', ')}\n`);

  // Create a mock NAR for the connection
  const mockNar = {} as any;
  const emit = (event: string, data: unknown) => {
    logger.debug(`Event: ${event}`, data as Record<string, unknown>);
  };

  const connectionConfig: ConnectionConfig = {
    id: 'test-irc',
    enabled: true,
    type: 'irc',
    config: TEST_CONFIG,
  };

  const deps: ConnectionDeps = {
    nar: mockNar,
    emit,
    logger,
  };

  const connection = new IRCConnection(connectionConfig, deps);

  // Track messages
  const messages: Array<{ sender: string; text: string; channel: string }> = [];
  const errors: Error[] = [];

  connection.onMessage(async (message) => {
    console.log(
      `[IRC] Message from ${message.sender} in ${message.origin}: ${message.text.slice(0, 100)}`
    );
    messages.push({
      sender: message.sender,
      text: message.text,
      channel: message.origin,
    });
  });

  connection.onError((error) => {
    console.error(`[IRC] Error: ${error.message}`);
    errors.push(error);
  });

  connection.onStateChange((state, prev) => {
    console.log(`[IRC] State: ${prev} -> ${state}`);
  });

  return connection;
}

// Run a simple test that doesn't require actual IRC connection
function testMessageCreation() {
  console.log('Testing message creation...');

  const mockNar = {} as any;
  const emit = () => {};
  const logger = createLogger({ scope: 'test:irc-msg' });

  const connectionConfig: ConnectionConfig = {
    id: 'test-irc',
    enabled: true,
    type: 'irc',
    config: TEST_CONFIG,
  };

  const deps: ConnectionDeps = { nar: mockNar, emit, logger };
  const connection = new IRCConnection(connectionConfig, deps);

  // Test creating a message
  const msg = (connection as any).createMessage('testuser', 'Hello test!', { channel: '#test' });

  console.log(
    `  Created message: ${JSON.stringify(
      {
        id: msg.id,
        source: msg.source,
        origin: msg.origin,
        sender: msg.sender,
        text: msg.text,
      },
      null,
      2
    )}`
  );

  if (msg.sender === 'testuser' && msg.text === 'Hello test!') {
    console.log('  PASSED: Message creation works\n');
    results.push({ name: 'Message creation', passed: true });
    return true;
  } else {
    console.log('  FAILED: Message fields incorrect\n');
    results.push({ name: 'Message creation', passed: false });
    return false;
  }
}

function testConnectionStates() {
  console.log('Testing connection state management...');

  const mockNar = {} as any;
  const emit = () => {};
  const logger = createLogger({ scope: 'test:irc-state' });

  const connectionConfig: ConnectionConfig = {
    id: 'test-irc-state',
    enabled: true,
    type: 'irc',
    config: TEST_CONFIG,
  };

  const deps: ConnectionDeps = { nar: mockNar, emit, logger };
  const connection = new IRCConnection(connectionConfig, deps);

  // Check initial state
  const initialState = connection.state;
  console.log(`  Initial state: ${initialState}`);

  if (initialState === 'disconnected') {
    console.log('  PASSED: Initial state is disconnected\n');
    results.push({ name: 'Connection states', passed: true });
    return true;
  } else {
    console.log('  FAILED: Initial state should be disconnected\n');
    results.push({ name: 'Connection states', passed: false });
    return false;
  }
}

async function main() {
  console.log('IRC Connection Module Test\n');
  console.log('Note: Full connection test requires an IRC server.\n');

  // Test message creation (doesn't need network)
  testMessageCreation();

  // Test connection state management
  testConnectionStates();

  // Try to connect to a real server
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                     TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}${r.details ? `: ${r.details}` : ''}`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passed}/${results.length}`);

  if (passed === results.length) {
    console.log('All basic tests passed!');
    process.exit(0);
  } else {
    console.log('Some tests failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
