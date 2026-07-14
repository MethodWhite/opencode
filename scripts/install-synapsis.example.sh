#!/usr/bin/env bash
set -euo pipefail

echo "==> opencode + synapsis integration"

# Check if synapsis is available
if ! command -v synapsis &>/dev/null; then
    echo "  ⚠ synapsis not found in PATH"
    echo "  Install it from: https://github.com/MethodWhite/synapsis"
    exit 1
fi

SYNAPSIS_PATH="$(command -v synapsis)"
SYNAPSIS_VERSION="$($SYNAPSIS_PATH --version 2>/dev/null || echo "unknown")"
echo "  ✓ synapsis found: $SYNAPSIS_PATH ($SYNAPSIS_VERSION)"

# Configure opencode to use synapsis MCP
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
mkdir -p "$(dirname "$CONFIG_FILE")"

if [ -f "$CONFIG_FILE" ]; then
    echo "  ✓ Existing config: $CONFIG_FILE"
else
    echo "{}" > "$CONFIG_FILE"
    echo "  ✓ Created config: $CONFIG_FILE"
fi

# Add synapsis MCP server using temporary file for cross-platform compat
TMP_FILE=$(mktemp)
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8') || '{}');
cfg.mcp = cfg.mcp || {};
cfg.mcp.synapsis = {
    type: 'local',
    command: ['$SYNAPSIS_PATH', 'mcp'],
    enabled: true
};
fs.writeFileSync('$TMP_FILE', JSON.stringify(cfg, null, 2));
" && mv "$TMP_FILE" "$CONFIG_FILE"

echo "  ✓ Synapsis MCP server configured"
echo "  ✓ Restart opencode to apply"
echo ""
echo "==> Verification:"
echo "  opencode mcp list  # should show 'synapsis'"
