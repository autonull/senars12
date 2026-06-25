#!/bin/bash
# Pi Agent with SeNARS MCP Integration
# Runs Pi coding agent with SeNARS MCP server configured
# Auto-installs pi-mcp-adapter if missing

set -euo pipefail

cd "$(dirname "$0")/.."

# Check if pi-mcp-adapter is installed in Pi's agent dir
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
MCP_ADAPTER_PATH="$PI_AGENT_DIR/npm/node_modules/pi-mcp-adapter/package.json"

if [[ ! -f "$MCP_ADAPTER_PATH" ]]; then
    echo "Installing pi-mcp-adapter..."
    npx pi install npm:pi-mcp-adapter
else
    echo "pi-mcp-adapter already installed"
fi

# Build SeNARS first to ensure MCP server works
echo "Building SeNARS..."
pnpm build

# Run Pi with SeNARS MCP
echo "Starting Pi agent with SeNARS MCP..."
exec npx pi "$@"
