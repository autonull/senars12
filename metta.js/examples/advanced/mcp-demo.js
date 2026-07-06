import readline from 'readline';
import path from 'path';
import {fileURLToPath} from 'url';
import {Client} from '../agent/src/mcp/Client.js';
import {ChatOpenAI} from "@langchain/openai";
import {ChatOllama} from "@langchain/ollama";
import {HumanMessage, ToolMessage} from "@langchain/core/messages";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.resolve(__dirname, '../agent/src/mcp/start-server.js');

// Transformer.js import (dynamic)
let pipeline;
try {
    const transformers = await import('@huggingface/transformers');
    pipeline = transformers.pipeline;
} catch (e) {
    console.warn("Transformer.js not found, skipping local model option.");
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

class DemoApp {
    constructor() {
        this.client = null;
        this.llm = null;
        this.tools = [];
    }

    async start() {
        console.log("=== SeNARS MCP Demo ===");

        await this.setupServer();
        await this.setupLLM();
        await this.loop();
    }

    async setupServer() {
        console.log("\nStarting SeNARS MCP Server...");
        this.client = new Client({
            command: "node",
            args: [SERVER_SCRIPT]
        });

        try {
            await this.client.connect();
            console.log("Connected to SeNARS MCP Server.");

            this.tools = await this.client.discoverTools();
            console.log(`Discovered ${this.tools.length} tools: ${this.tools.map(t => t.name).join(', ')}`);
        } catch (err) {
            console.error("Failed to connect to server:", err);
            process.exit(1);
        }
    }

    async setupLLM() {
        console.log("\nSelect LLM Provider:");
        console.log("1. Transformer.js (Local, e.g. Xenova/Qwen1.5-0.5B-Chat)");
        console.log("2. Ollama (e.g. llama3)");
        console.log("3. OpenAI (e.g. gpt-4o)");

        const choice = await ask("Choice (1-3): ");

        if (choice === '1') {
            if (!pipeline) {
                console.error("Transformer.js not available.");
                return await this.setupLLM();
            }
            const model = await ask("Enter model name (default: Xenova/Qwen1.5-0.5B-Chat): ") || "Xenova/Qwen1.5-0.5B-Chat";
            this.llm = new LocalTransformerLLM(model);
        } else if (choice === '2') {
            const model = await ask("Enter Ollama model (default: llama3): ") || "llama3";
            const baseUrl = await ask("Enter Base URL (default: http://localhost:11434): ") || "http://localhost:11434";
            this.llm = new LangChainWrapper(new ChatOllama({model, baseUrl}));
        } else if (choice === '3') {
            console.log("Configuring OpenAI-compatible provider (e.g. LM Studio, LocalAI, vLLM)...");
            const baseUrl = await ask("Enter Base URL (e.g. http://localhost:1234/v1, leave empty for default): ");
            const apiKey = process.env.OPENAI_API_KEY || await ask("Enter API Key (default: 'not-needed'): ") || "not-needed";
            const model = await ask("Enter model name (default: local-model): ") || "local-model";

            const config = {model, apiKey};
            if (baseUrl) config.configuration = {baseURL: baseUrl};

            this.llm = new LangChainWrapper(new ChatOpenAI(config));
        } else {
            console.log("Invalid choice.");
            return await this.setupLLM();
        }

        await this.llm.initialize(this.tools);
    }

    async loop() {
        while (true) {
            console.log("\n--- New Interaction ---");
            console.log("1. Premade: 'Birds are animals. Tweety is a bird. Is Tweety an animal?'");
            console.log("2. Premade: 'Check memory for concept 'bird''");
            console.log("3. Custom Input");
            console.log("4. Test Suite (Verify MCP Functions)");
            console.log("5. Exit");

            const choice = await ask("Select input: ");
            let input = "";

            if (choice === '1') input = "I know that birds are animals and Tweety is a bird. based on this, is Tweety an animal? Use the reason tool.";
            else if (choice === '2') input = "What do you know about 'bird' in your memory?";
            else if (choice === '3') input = await ask("Enter your prompt: ");
            else if (choice === '4') {
                await this.runTestSuite();
                continue;
            } else if (choice === '5') break;
            else continue;

            console.log(`\nUser: ${input}`);
            console.log("Agent is thinking...");

            try {
                const response = await this.llm.chat(input, this.client);
                console.log(`\nAgent: ${response}`);
            } catch (err) {
                console.error("Error during chat:", err);
            }
        }

        await this.shutdown();
    }

    async runTestSuite() {
        console.log("\n=== Running MCP Test Suite ===");

        try {
            // 1. Ping
            console.log("Test 1: Ping");
            try {
                const ping = await this.client.callTool('ping', {});
                console.log("Result:", ping.content[0].text);
            } catch (e) {
                console.log("Ping tool not found or failed");
            }

            // 2. Reason
            console.log("\nTest 2: Reason (Simple Deduction)");
            const reason = await this.client.callTool('reason', {
                premises: ["<test_a --> test_b>.", "<test_b --> test_c>."],
                goal: "<test_a --> test_c>?"
            });
            console.log("Result:\n" + reason.content[0].text);

            // 3. Memory
            console.log("\nTest 3: Memory Query");
            const memory = await this.client.callTool('memory-query', {query: 'test_b'});
            console.log("Result:\n" + memory.content[0].text);

            // 4. Code Execution
            console.log("\nTest 4: Code Execution (Math)");
            const code = await this.client.callTool('evaluate_js', {code: "1 + 1"});
            console.log("Result:\n" + code.content[0].text);

            console.log("\n=== Test Suite Completed ===");
        } catch (err) {
            console.error("Test Suite Failed:", err);
        }
    }

    async shutdown() {
        console.log("Shutting down...");
        if (this.client) await this.client.disconnect();
        rl.close();
        process.exit(0);
    }
}

class LocalTransformerLLM {
    constructor(modelName) {
        this.modelName = modelName;
        this.generator = null;
        this.tools = [];
    }

    async initialize(tools) {
        console.log(`Loading local model ${this.modelName}...`);
        this.generator = await pipeline('text-generation', this.modelName);
        this.tools = tools;
        console.log("Model loaded.");
    }

    async chat(input, mcpClient) {
        // Simple ReAct-style prompt for local model
        const toolDesc = this.tools.map(t => `${t.name}: ${t.description} (Schema: ${JSON.stringify(t.inputSchema)})`).join('\n');
        const systemPrompt = `You are a helpful assistant with access to these tools:\n${toolDesc}\n\nIf you need to use a tool, output JSON: {"tool": "name", "args": {...}}.\nOtherwise just reply text.\n\nUser: ${input}\nAssistant:`;

        const output = await this.generator(systemPrompt, {max_new_tokens: 200, return_full_text: false});
        let text = output[0].generated_text.trim();

        console.log(`[Raw Model Output]: ${text}`);

        // Try to parse tool call
        try {
            // Find JSON in text
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                const jsonStr = text.substring(start, end + 1);
                const json = JSON.parse(jsonStr);
                if (json.tool && json.args) {
                    console.log(`[Tool Call]: ${json.tool} with args`, json.args);
                    const result = await mcpClient.callTool(json.tool, json.args);

                    let displayResult = "";
                    if (result.content && result.content[0] && result.content[0].text) {
                        displayResult = result.content[0].text;
                    } else {
                        displayResult = JSON.stringify(result, null, 2);
                    }
                    console.log(`\n=== SeNARS Output ===\n${displayResult}\n=====================\n`);

                    // Feed back to model
                    const followUpPrompt = `${systemPrompt}${text}\nSystem: Tool output: ${displayResult}\nAssistant:`;
                    const followUp = await this.generator(followUpPrompt, {
                        max_new_tokens: 200,
                        return_full_text: false
                    });
                    return followUp[0].generated_text.trim();
                }
            }
        } catch (e) {
            console.log("Failed to parse tool call or execute it:", e.message);
        }

        return text;
    }
}

class LangChainWrapper {
    constructor(model) {
        this.model = model;
        this.tools = [];
    }

    async initialize(tools) {
        this.tools = tools;
        // Bind tools to model
        const formattedTools = tools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
            }
        }));

        if (this.model.bindTools) {
            this.model = this.model.bindTools(formattedTools);
        }
    }

    async chat(input, mcpClient) {
        const messages = [new HumanMessage(input)];
        const result = await this.model.invoke(messages);

        if (result.tool_calls && result.tool_calls.length > 0) {
            console.log(`[Tool Calls]:`, result.tool_calls);
            messages.push(result);

            for (const call of result.tool_calls) {
                const toolResult = await mcpClient.callTool(call.name, call.args);

                let content = "";
                if (toolResult.content && toolResult.content[0]?.text) {
                    content = toolResult.content[0].text;
                } else {
                    content = JSON.stringify(toolResult);
                }

                console.log(`\n=== SeNARS Output (${call.name}) ===\n${content}\n==============================\n`);

                messages.push(new ToolMessage({
                    tool_call_id: call.id || "call_1",
                    content: content,
                    name: call.name
                }));
            }

            const final = await this.model.invoke(messages);
            return final.content;
        }

        return result.content;
    }
}

const app = new DemoApp();
app.start().catch(err => console.error(err));
