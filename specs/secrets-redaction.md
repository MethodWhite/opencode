# Secrets Redaction

Prevent accidental credential exposure when AI agents process tool output. Shell commands, file reads, git diffs, and environment inspection routinely surface API keys, tokens, and passwords. Today these flow verbatim to the LLM, appear in session history, and can leak through share links.

## Design

Redaction happens at the tool output boundary, before content reaches the LLM or session persistence. The raw tool result is never discarded — redaction only affects what the model sees and what gets stored in session history.

### Detection

Two detection strategies, applied in order:

1. **Pattern match** — known credential formats (ghp_, sk-, AKIA, -----BEGIN, etc.). Defined as an allowlist of regex patterns.
2. **Entropy scan** — for lines that match nothing but contain high-entropy strings (base64, hex). Shannon entropy > 4.5 per char over a 20+ char token.

Detection runs on every `ToolResult` string output: stdout, stderr, file content, shell output, diff output. Binary output is skipped.

### Redaction

Replace the matched secret with a deterministic placeholder that preserves structure:

```
GITHUB_TOKEN=ghp_**************
AWS_KEY=AKIA************
```

Placeholders preserve the key name, prefix, and length so the model can still reason about which credential was used and whether one is present, without seeing the value.

The raw `ToolResult` holds both the original and redacted content:

```
ToolResult {
  redacted: string    // for the LLM and session history
  original: string    // only for local display or explicit user request
}
```

### Session persistence

Session history stores only `redacted`. The `original` is held in memory and discarded when the session ends. Share links never contain original content.

### Configuration

```json
{
  "secrets": {
    "redact": true,
    "additionalPatterns": ["CUSTOM_KEY_([A-Z0-9]+)_[A-Z0-9]{16}"],
    "allowPatterns": ["example_[A-Z]+"],  // known-safe patterns
    "entropyThreshold": 4.5,
    "entropyMinLength": 20
  }
}
```

All fields optional. `redact` defaults to `true`. `additionalPatterns` and `allowPatterns` merge with built-in defaults.

### Built-in patterns

```
git:     ghp_[A-Za-z0-9]{36}
         github_pat_[A-Za-z0-9]{82}
         glpat-[A-Za-z0-9_-]{20,}
aws:     AKIA[0-9A-Z]{16}
         (aws_access_key_id|aws_secret_access_key)\\s*=\\s*\\S+
generic: sk-[A-Za-z0-9]{20,}
         -----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----
         (token|secret|password|api[_-]?key)\\s*[:=]\\s*['\"]?\\S{8,}
```

### Policy integration

The existing policy engine (`specs/v2/provider-policy.md`) decides whether tools are allowed. Secrets redaction is orthogonal — it does not block tool execution, it only scrubs output. A future policy rule could gate redaction bypass:

```json
{
  "tools": {
    "shell": {
      "policy": "redact-secrets"
    }
  }
}
```

## Open questions

- Should the user be able to reveal a redacted value mid-session? (Yes — via a permission prompt similar to tool approval.)
- Should `session.summarize()` strip redaction? (No — summaries should stay redacted.)
- How do we handle secrets in images or screenshots? (Out of scope for v1 — defer to MCP-based OCR + redaction if needed.)

## Implementation sketch

```
packages/core/src/secrets/
  detector.ts       — pattern + entropy matching, returns Replacement[]
  redactor.ts       — applies replacements to string content
  config.ts         — built-in patterns + user config merge
  types.ts          — Replacement, RedactionConfig

packages/opencode/src/agent/
  tool-execution.ts — apply redactor to ToolResult.output before LLM
  session-write.ts  — apply redactor before persisting messages
```
