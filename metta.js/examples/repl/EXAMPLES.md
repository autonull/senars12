# SeNARS Agent REPL Examples

Production-ready examples demonstrating the SeNARS Agent REPL with Ollama integration.

## Prerequisites

- Ollama installed and running (`ollama serve`)
- A model pulled (e.g., `ollama pull llama3`)

## Examples

| Example                                                        | Description                     |
|----------------------------------------------------------------|---------------------------------|
| [example-agent-repl-ollama.js](example-agent-repl-ollama.js)   | Full agent demo with Ollama LM  |
| [example-research-scenario.js](example-research-scenario.js)   | Multi-agent research simulation |
| [example-fallback-mechanism.js](example-fallback-mechanism.js) | LM/NARS routing demo            |

## Quick Start

```bash
# Start Ollama
ollama serve

# Run main demo
node examples/repl/example-agent-repl-ollama.js

# Or with custom model
OLLAMA_MODEL=mistral node examples/repl/example-agent-repl-ollama.js
```

## Run All Demos

```bash
node examples/repl/run-all-demos.js
```

## Features Demonstrated

- **Agent Management**: Create, configure, and switch between AI agents
- **Hybrid Intelligence**: LM + NARS symbolic reasoning integration
- **Intelligent Routing**: Automatic detection of Narsese vs natural language
- **Goal Planning**: Setting goals and generating plans
- **Complex Reasoning**: Multi-step logical and contextual reasoning