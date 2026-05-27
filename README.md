# @quickprosp/mcp-server

Drive your QuickProsp outreach from Claude Desktop, Cursor, or Claude Code via the [Model Context Protocol](https://modelcontextprotocol.io).

## What you can do

- *"Show me my top-replying campaign last week and pause it."*
- *"Find every contact at a SaaS company that hasn't been emailed yet."*
- *"How many credits do I have left this cycle?"*
- *"Which of my mailboxes is closest to its daily send limit?"*

## Install

### 1. Get an API key

1. Open [app.quickprosp.com/api-keys](https://app.quickprosp.com/api-keys)
2. Click **New API key**, name it (e.g. "Claude Desktop on laptop"), and copy the `qp_live_…` secret

### 2. Configure your AI host

**Claude Desktop** — open Settings → Developer → Edit Config, then add:

```json
{
  "mcpServers": {
    "quickprosp": {
      "command": "npx",
      "args": ["-y", "https://quickprosp.com/mcp/quickprosp-mcp-server-latest.tgz"],
      "env": {
        "QUICKPROSP_API_KEY": "qp_live_…"
      }
    }
  }
}
```

Restart Claude Desktop. The QuickProsp tools will appear under the 🔧 menu.

**Cursor** — Settings → Features → MCP servers → Add. Use the same JSON snippet under `mcpServers`.

**Claude Code** — `claude mcp add quickprosp -- npx -y https://quickprosp.com/mcp/quickprosp-mcp-server-latest.tgz` (set `QUICKPROSP_API_KEY` in your shell env).

## Available tools

| Tool | What it does |
|---|---|
| `list_campaigns` | List campaigns with status, contact count, progress |
| `get_campaign_stats` | Opens / clicks / replies / bounces / reply rate per campaign |
| `pause_campaign` / `resume_campaign` | Stop or restart a campaign |
| `list_contacts` | Search + filter contacts (text, list, status, paginated) |
| `get_recent_replies` | Recent replies with sentiment classification |
| `list_email_accounts` | Connected mailboxes with health + daily-send usage |
| `get_credit_balance` | Remaining credits + plan tier |

All tools require `organisationId`. Ask Claude *"What's my organization id?"* once and it'll remember for the rest of the conversation.

## Building from source

The package is hosted as a tarball at `https://quickprosp.com/mcp/quickprosp-mcp-server-latest.tgz` — `npx` installs and runs it for you. If you want to inspect or modify the source, download the tarball and extract it:

```sh
curl -O https://quickprosp.com/mcp/quickprosp-mcp-server-latest.tgz
tar -xzf quickprosp-mcp-server-latest.tgz
cd package
QUICKPROSP_API_KEY=qp_live_… node dist/index.js
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `QUICKPROSP_API_KEY` | — (required) | Your `qp_live_…` secret from app.quickprosp.com/api-keys |
| `QUICKPROSP_API_BASE` | `https://api.quickprosp.com` | Override for local development or self-hosted instances |

## Security

- API keys are scoped to one user + one organization
- Keys are revocable at any time from the in-app UI — clients lose access immediately
- The raw secret is shown exactly once at creation; only a 12-char prefix is stored for display
- Revoke a key if you suspect leak: app.quickprosp.com/api-keys → click 🗑

## License

MIT
