import {ReplEngine} from '../../core/src/repl/ReplEngine.js';

// Create a simple test to verify the new unified REPL functionality
const engine = new ReplEngine();

// Initialize the engine
await engine.initialize();

console.log("Testing input processing with unified architecture...");

// Test input
try {
    const result = await engine.processNarsese("(a --> b).");
    console.log("Input processed successfully:", result);

    // Process one step to ensure tasks are processed
    await engine.executeCommand('next');

    // Get stats
    const stats = engine.getStats();
    console.log("Memory stats after input:");
    console.log("- Total concepts:", stats.memoryStats?.conceptCount || stats.memoryStats?.totalConcepts || 0);
    console.log("- Total tasks:", stats.memoryStats?.taskCount || stats.memoryStats?.totalTasks || 0);

    // Get beliefs
    const beliefs = engine.getBeliefs();
    console.log("Current beliefs:", beliefs.length);
} catch (error) {
    console.error("Error during test:", error);
}

console.log("Test completed with unified architecture");
await engine.shutdown();