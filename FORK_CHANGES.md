# OpenCode Fork - MethodWhite Changes

## Changelog

### 2026-07-14

#### Added
- **CLI Todo Command**: `opencode todo {add|list|done|clear}` for interactive todo management
  - `todo add <content> --priority=<high|medium|low>` - Add new todo
  - `todo list` - List all todos for current session
  - `todo done <index>` - Mark todo as completed
  - `todo clear` - Clear all completed todos

- **CLI LSP Command**: `opencode lsp {status|install|diagnostics}` for LSP management
  - `lsp status` - Show status of all LSP servers
  - `lsp install <language>` - Install LSP server for a language
  - `lsp diagnostics <file>` - Show diagnostics for a file

- **Synapsis MCP Auto-Detection**: Automatically detects and connects to Synapsis MCP server if available in PATH

#### Fixed
- Resolved type errors in CLI command handlers

#### Security
- Added supply chain security checks for MCP server connections

---

## Features from Upstream (not in official release)

| Feature | Status | Description |
|---------|--------|-------------|
| Todo Interactive | ✅ Added | CLI command for todo management |
| LSP CLI | ✅ Added | CLI commands for LSP management |
| Synapsis Integration | ✅ Added | Auto-detect Synapsis MCP server |
| MCP Auto-Discovery | ✅ Added | Find MCP servers in PATH |

---

## Build Instructions

```bash
cd /home/methodwhite/opencode
bun install
bun run build
```

## Testing

```bash
cd packages/cli
bun typecheck
bun test
```
