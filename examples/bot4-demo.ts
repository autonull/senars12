/**
 * BOT4.md Implementation Demo
 * 
 * This file demonstrates the complete BOT4.md architecture
 * showing how all components work together.
 */

import {Bot} from '../src/agent/Bot.js';
import {BotProfile} from '../src/agent/BotProfile.js';
import {loadConfig, DegradationManager} from '../src/agent/index.js';
import {LMStreamAdapter, ChannelStreamer} from '../src/agent/streaming/index.js';
import {buildStatusBar, VISUAL, Spinner} from '../src/agent/tui/index.js';
import {SeNARSFactory} from '../src/nar/nar.js';
import {createLMClient} from '../src/nar/lm/index.js';

/**
 * Example 1: Basic Bot Setup with Full Configuration
 */
async function example1_BasicBotSetup() {
  // Load configuration from file with env overrides
  const config = await loadConfig('bot.config.jsonc');
  
  // Create bot profile
  const profile = new BotProfile({
    name: config.profile.name,
    personality: config.profile.personality,
  });
  
  // Initialize capabilities
  const lm = config.capabilities.lm.enabled 
    ? await createLMClient(config.capabilities.lm)
    : undefined;
    
  const nar = config.capabilities.senars.enabled
    ? SeNARSFactory.createDefault(config.capabilities.senars)
    : undefined;
  
  // Create degradation manager
  const degradation = new DegradationManager();
  degradation.startHealthChecks();
  
  // Create bot instance
  const bot = new Bot({
    profile,
    lm,
    nar,
    config: {
      streaming: {
        enabled: config.streaming.enabled,
        showReasoningSteps: config.streaming.showReasoningSteps,
        showToolCalls: config.streaming.showToolCalls,
      },
      tui: config.tui,
    },
  });
  
  console.log(
    VISUAL.botResponse(`Bot initialized in ${bot.capabilities.mode} mode`)
  );
  
  return {bot, degradation};
}

/**
 * Example 2: Processing Messages with Streaming
 */
async function example2_StreamProcessing(bot: Bot) {
  const message = {
    id: 'msg-1',
    text: 'Why do birds migrate south?',
    sender: 'user',
    source: 'cli',
    timestamp: Date.now(),
  };
  
  const conversation = bot.stateManager.getOrCreate('user');
  const connInfo = bot.getConnectionInfo(message, async (response) => {
    if (typeof response === 'string') {
      console.log(VISUAL.botResponse(response));
    } else {
      // Handle stream chunk
      if (response.type === 'status' && response.content === 'typing') {
        const spinner = new Spinner();
        spinner.start('thinking...');
        return () => spinner.stop();
      }
      console.log(VISUAL.botResponse(response.content || ''));
    }
  });
  
  const response = await bot.processMessage(message, connInfo, conversation);
  
  // Display reasoning if available
  if (response.reasoning && response.reasoning.steps > 0) {
    console.log(
      VISUAL.reasoningStep(
        `Derived ${response.reasoning.steps} belief(s)`
      )
    );
  }
  
  return response;
}

/**
 * Example 3: Status Bar Display
 */
function example3_StatusBar(bot: Bot) {
  const stats = {
    lmModel: bot.capabilities.hasLM ? 'claude-sonnet-4' : undefined,
    lmAvailable: bot.capabilities.hasLM,
    narConcepts: bot.nar?.getStatistics?.()?.totalConcepts ?? 0,
    narAvailable: bot.capabilities.hasSeNARS,
    turn: bot.stateManager.getOrCreate('user').messages.length,
    mode: bot.capabilities.mode,
  };
  
  const statusBar = buildStatusBar(stats, {
    statusBar: true,
    colors: true,
  } as any);
  
  console.log(statusBar);
}

/**
 * Example 4: Degradation Handling
 */
async function example4_DegradationHandling() {
  const degradation = new DegradationManager();
  
  // Listen for degradation events
  degradation.onDegradation((message) => {
    console.log(VISUAL.thinking(message));
  });
  
  // Simulate LM failure
  degradation.setLMAvailability(false);
  console.log(
    VISUAL.error('LM unavailable - bot will use SeNARS-only mode')
  );
  
  // Bot automatically adapts
  if (!degradation.isLMAvailable()) {
    console.log('Switched to reasoning mode');
  }
  
  // Recovery
  degradation.setLMAvailability(true);
  console.log(VISUAL.botResponse('LM restored - full mode active'));
}

/**
 * Example 5: Visual Conventions
 */
function example5_VisualConventions() {
  console.log('\n--- Visual Conventions Demo ---\n');
  
  // User input
  console.log(VISUAL.userInput('Why do birds fly?'));
  
  // Bot response
  console.log(VISUAL.botResponse('Birds fly for migration and food.'));
  
  // Reasoning step
  console.log(
    VISUAL.reasoningStep('(<bird --> animal>. :1.0:0.9)')
  );
  
  // Tool call
  console.log(VISUAL.toolCall('search: bird migration = 42 results'));
  
  // Error
  console.log(VISUAL.error('LM timeout - using cached response'));
  
  // Thinking indicator
  console.log(VISUAL.thinking('analyzing...'));
  
  // Mode indicator
  console.log(VISUAL.modeIndicator('auto'));
  
  // Capability status
  console.log(VISUAL.capabilityStatus('LM', true));
  console.log(VISUAL.capabilityStatus('NAR', true));
}

/**
 * Main Demo Runner
 */
async function main() {
  console.log('=== BOT4.md Implementation Demo ===\n');
  
  try {
    // Example 1: Setup
    console.log('1. Basic Bot Setup');
    const {bot} = await example1_BasicBotSetup();
    
    // Example 2: Streaming
    console.log('\n2. Stream Processing');
    await example2_StreamProcessing(bot);
    
    // Example 3: Status Bar
    console.log('\n3. Status Bar');
    example3_StatusBar(bot);
    
    // Example 4: Degradation
    console.log('\n4. Degradation Handling');
    await example4_DegradationHandling();
    
    // Example 5: Visual Conventions
    console.log('\n5. Visual Conventions');
    example5_VisualConventions();
    
    console.log('\n=== Demo Complete ===');
  } catch (error) {
    console.error(
      VISUAL.error(
        `Demo failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// Run demo if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  example1_BasicBotSetup,
  example2_StreamProcessing,
  example3_StatusBar,
  example4_DegradationHandling,
  example5_VisualConventions,
};
