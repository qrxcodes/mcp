# QRX MCP server (stdio)

**Art QR codes that always scan, from any MCP client.**

[![npm](https://img.shields.io/npm/v/@qrxcodes/mcp)](https://www.npmjs.com/package/@qrxcodes/mcp)
[![CI](https://github.com/qrxcodes/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/qrxcodes/mcp/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

[QRX](https://qrx.codes) paints a QR code into artwork from a description and a link, then decodes it before handing it over, so every code it returns scans. This package is a local stdio MCP server for clients that run servers as a command. It forwards everything to the hosted QRX MCP server at `https://qrx.codes/mcp`, so you get the same tools, schemas and interactive views.

If your client can connect to a remote server by URL, you can skip this package and use `https://qrx.codes/mcp` directly. See [qrx.codes/developers/mcp](https://qrx.codes/developers/mcp).

```bash
npx -y @qrxcodes/mcp
```

Requires Node.js 18 or later. Listed in the official MCP Registry as `codes.qrx/mcp`.

## Get an API key

1. Sign in at [qrx.codes](https://qrx.codes) (free).
2. Create a key at [qrx.codes/developers/keys](https://qrx.codes/developers/keys). It starts with `qrx_`.
3. Give it to the server as the `QRX_API_KEY` environment variable, as in the examples below.

Without a key the server still starts and clients can list the tools (from QRX's public server card, or a copy bundled with this package). Calling a tool returns an error asking you to set `QRX_API_KEY`.

## Install

<details open>
<summary><b>Claude Desktop</b></summary>

Open **Settings → Developer → Edit Config** and add this to `claude_desktop_config.json`, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "qrx_live_…" }
    }
  }
}
```

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --scope user --env QRX_API_KEY=$QRX_API_KEY qrx -- npx -y @qrxcodes/mcp
```

Or in a project's `.mcp.json` (each person sets their own `QRX_API_KEY`):

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "${QRX_API_KEY}" }
    }
  }
}
```

</details>

<details>
<summary><b>Cursor</b></summary>

Add to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "${env:QRX_API_KEY}" }
    }
  }
}
```

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Add to `.vscode/mcp.json`. VS Code asks for the key once and stores it securely:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "qrx-api-key",
      "description": "QRX API key (starts with qrx_)",
      "password": true
    }
  ],
  "servers": {
    "qrx": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "${input:qrx-api-key}" }
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Edit `mcp_config.json` (macOS/Linux `~/.codeium/windsurf/mcp_config.json`, Windows `%USERPROFILE%\.codeium\windsurf\mcp_config.json`; Devin Desktop uses `~/.config/devin/mcp_config.json`):

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "qrx_live_…" }
    }
  }
}
```

</details>

<details>
<summary><b>Cline</b></summary>

Open **MCP Servers → Configure MCP Servers** and add to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "qrx_live_…" },
      "disabled": false,
      "autoApprove": ["list_styles", "get_qr_code", "list_qr_codes", "get_account", "get_profile"]
    }
  }
}
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add -e QRX_API_KEY=$QRX_API_KEY qrx npx -- -y @qrxcodes/mcp
```

Or in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "qrx": {
      "command": "npx",
      "args": ["-y", "@qrxcodes/mcp"],
      "env": { "QRX_API_KEY": "$QRX_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Any other stdio client</b></summary>

Run `npx -y @qrxcodes/mcp` with `QRX_API_KEY` in its environment. On Windows, clients that can't start `npx` directly can use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@qrxcodes/mcp"]`.

</details>

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `QRX_API_KEY` | none | Your QRX API key, sent to the remote server as `Authorization: Bearer <key>` |
| `QRX_MCP_URL` | `https://qrx.codes/mcp` | The remote server to forward to, for example a staging server |
| `QRX_MCP_SERVER_CARD_URL` | `/.well-known/mcp/server-card.json` on the `QRX_MCP_URL` origin | The public server card, used to list the tools when there is no valid key |

## Tools

| Tool | What it does |
|---|---|
| `generate_qr_code` | Starts a new art QR code from a prompt and a link. Returns the code's id straight away. |
| `get_qr_code` | Gets a code's status, image and short link, waiting briefly while it is painted. |
| `list_qr_codes` | Lists your codes, newest first. |
| `change_qr_code_destination` | Points an existing code at a new link without reprinting it (on a paid plan). |
| `get_account` | Shows your plan and how many codes are left today. |
| `get_profile` | Shows which QRX account is connected. |
| `list_styles` | Lists the looks you can pass to `generate_qr_code`. |

The tool list, input and output schemas and annotations come from the remote server at runtime, so they always match the hosted service. Clients that support MCP Apps also get the interactive code view (`ui://qrx/code-v1.html`).

Try: "Make a QR code for https://example.com/menu that looks like a watercolour street of cafés."

## How it works

The server speaks MCP over stdio to your client and over Streamable HTTP to `https://qrx.codes/mcp`. It forwards `initialize` (including your client's capabilities), tool, resource and prompt requests, cancellations and progress notifications, and returns the remote's results unchanged. If the connection to the remote drops, it reconnects on the next request and retries requests that can't change anything; it never retries a tool that creates or changes a code.

It sends requests only to the configured URL. Each request carries your API key and the arguments your client passes to the tools. The server writes nothing to disk and logs only to stderr.

## Development

```bash
npm install
npm test      # builds, then runs the tests against a local mock of the remote server
```

See [RELEASING.md](RELEASING.md) for publishing a new version.

Run your build against QRX with the MCP Inspector:

```bash
npm run build
npx @modelcontextprotocol/inspector -e QRX_API_KEY=$QRX_API_KEY node dist/index.js
```

## Links

- MCP server docs: [qrx.codes/developers/mcp](https://qrx.codes/developers/mcp)
- API docs: [qrx.codes/developers](https://qrx.codes/developers)
- Remote server listing, plugins and skill: [qrxcodes/qrx-mcp](https://github.com/qrxcodes/qrx-mcp)
- Privacy: [qrx.codes/privacy](https://qrx.codes/privacy) · Terms: [qrx.codes/terms](https://qrx.codes/terms)
- Support and security reports: hello@qrx.codes

## Licence

[MIT](LICENSE). The QRX service itself is a hosted product, governed by the [QRX terms](https://qrx.codes/terms).
