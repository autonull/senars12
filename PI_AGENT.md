# Pi Agent + SeNARS MCP Integration

Run Pi coding agent with SeNARS NARS reasoning capabilities via MCP.

## Quick Start

```bash
# Start Ollama (if not running)
ollama serve

# Pull a model (if needed)
ollama pull qwen2.5-coder:7b

# Run Pi agent (auto-installs pi-mcp-adapter if needed)
pnpm pi --provider ollama --model qwen2.5-coder:7b
```

## Available Commands

```bash
# Interactive mode with Ollama
pnpm pi --provider ollama --model qwen2.5-coder:7b

# Non-interactive (process and exit)
pnpm pi --provider ollama --model qwen2.5-coder:7b --no-session -p "your prompt"

# Continue previous session
pnpm pi --provider ollama --model qwen2.5-coder:7b --continue "follow up"

# Any Ollama model
pnpm pi --provider ollama --model llama3.2:3b "prompt"
pnpm pi --provider ollama --model mistral:7b "prompt"
```

## In Pi Session

| Command | Description |
|---------|-------------|
| `/mcp` | Interactive MCP panel |
| `/mcp tools` | List all SeNARS tools |
| `/mcp reconnect` | Reconnect MCP servers |
| `mcp({search: "query"})` | Search tools |
| `mcp({tool: "name", args: '{"key": "val"}'})` | Call tool |

## How It Works

1. `pnpm pi` runs `scripts/pi-agent.sh`
2. Script checks for `pi-mcp-adapter` in `~/.pi/agent/npm/node_modules/`
3. Auto-installs via `npx pi install npm:pi-mcp-adapter` if missing
4. Builds SeNARS (`pnpm build`) to compile MCP server
5. Launches `npx pi` with `.mcp.json` config pointing to `pnpm mcp`

## Config

The `.mcp.json` in project root configures SeNARS as an MCP server:

```json
{
  "mcpServers": {
    "senars": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": ".",
      "lifecycle": "lazy",
      "directTools": true
    }
  }
}
```

- `lazy` - Server starts on first tool call (saves resources)
- `directTools: true` - SeNARS tools appear directly in Pi's tool list

## Adding More MCP Servers

Edit `.mcp.json` or run `/mcp setup` in Pi to add servers like:
- `npx -y @modelcontextprotocol/server-github`
- `npx -y @modelcontextprotocol/server-postgres`
- Any npm MCP server

## Other Providers

Pi supports many providers via `--provider` flag:
- `ollama` (local, HTTP API) - **Default for SeNARS**
- `openrouter` - Access 100+ models
- `anthropic` - Claude models
- `openai` - GPT models
- `google` - Gemini models
- And more (see `pi --help`)
