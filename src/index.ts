#!/usr/bin/env node
/**
 * QuickProsp MCP server.
 *
 * Exposes the QuickProsp HTTP API as Model Context Protocol tools so AI hosts
 * (Claude Desktop, Cursor, Claude Code, …) can drive cold-email outreach from
 * chat: list and pause campaigns, query contacts, check inboxes, etc.
 *
 * Transport: stdio (the standard for local MCP servers spawned by hosts).
 * Auth: long-lived QuickProsp API key from the {@code QUICKPROSP_API_KEY}
 * environment variable. Generate one at https://app.quickprosp.com/api-keys.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_BASE = process.env.QUICKPROSP_API_BASE ?? 'https://api.quickprosp.com';
const API_KEY = process.env.QUICKPROSP_API_KEY ?? '';

if (!API_KEY) {
  console.error('QUICKPROSP_API_KEY env var is required. Generate one at https://app.quickprosp.com/api-keys');
  process.exit(1);
}

async function qp(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QuickProsp API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

function asText(value: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

// ─────────────────────────── Tool definitions ───────────────────────────

const tools = [
  {
    name: 'list_campaigns',
    description: 'List campaigns for the organization, with status (DRAFT / ACTIVE / PAUSED / COMPLETED), total contacts, and progress.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationId: { type: 'string', description: 'Organisation id. Required.' },
        status: { type: 'string', description: 'Optional status filter: DRAFT | ACTIVE | PAUSED | COMPLETED' },
      },
      required: ['organisationId'],
    },
    schema: z.object({ organisationId: z.string(), status: z.string().optional() }),
    handler: async (a: { organisationId: string; status?: string }) => {
      const params = new URLSearchParams({ organisationId: a.organisationId });
      if (a.status) params.set('status', a.status);
      return await qp(`/api/campaigns?${params.toString()}`);
    },
  },
  {
    name: 'get_campaign_stats',
    description: 'Detailed campaign performance: emails sent, opens, clicks, replies, bounces, unsubscribes, and reply-rate.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        organisationId: { type: 'string' },
      },
      required: ['campaignId', 'organisationId'],
    },
    schema: z.object({ campaignId: z.string(), organisationId: z.string() }),
    handler: async (a: { campaignId: string; organisationId: string }) => {
      return await qp(`/api/campaigns/${encodeURIComponent(a.campaignId)}/stats?organisationId=${encodeURIComponent(a.organisationId)}`);
    },
  },
  {
    name: 'pause_campaign',
    description: 'Pause an active campaign. Stops scheduled sends without touching contact state.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        organisationId: { type: 'string' },
      },
      required: ['campaignId', 'organisationId'],
    },
    schema: z.object({ campaignId: z.string(), organisationId: z.string() }),
    handler: async (a: { campaignId: string; organisationId: string }) => {
      return await qp(`/api/campaigns/${encodeURIComponent(a.campaignId)}/pause?organisationId=${encodeURIComponent(a.organisationId)}`, { method: 'POST' });
    },
  },
  {
    name: 'resume_campaign',
    description: 'Resume a paused campaign.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        organisationId: { type: 'string' },
      },
      required: ['campaignId', 'organisationId'],
    },
    schema: z.object({ campaignId: z.string(), organisationId: z.string() }),
    handler: async (a: { campaignId: string; organisationId: string }) => {
      return await qp(`/api/campaigns/${encodeURIComponent(a.campaignId)}/resume?organisationId=${encodeURIComponent(a.organisationId)}`, { method: 'POST' });
    },
  },
  {
    name: 'list_contacts',
    description: 'Search and filter contacts. Supports text search, list filter, status filter (REPLIED / BOUNCED / UNSUBSCRIBED / etc.), and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationId: { type: 'string' },
        search: { type: 'string', description: 'Optional text match against name, email, company' },
        listId: { type: 'string', description: 'Optional contact list filter' },
        status: { type: 'string', description: 'Optional status filter' },
        page: { type: 'number', description: 'Zero-indexed page number (default 0)' },
        size: { type: 'number', description: 'Page size (default 20, max 200)' },
      },
      required: ['organisationId'],
    },
    schema: z.object({
      organisationId: z.string(),
      search: z.string().optional(),
      listId: z.string().optional(),
      status: z.string().optional(),
      page: z.number().int().min(0).optional(),
      size: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (a: {
      organisationId: string; search?: string; listId?: string; status?: string; page?: number; size?: number;
    }) => {
      const params = new URLSearchParams({ organisationId: a.organisationId });
      if (a.search) params.set('search', a.search);
      if (a.listId) params.set('listId', a.listId);
      if (a.status) params.set('status', a.status);
      params.set('page', String(a.page ?? 0));
      params.set('size', String(a.size ?? 20));
      return await qp(`/api/contacts/filtered?${params.toString()}`);
    },
  },
  {
    name: 'get_recent_replies',
    description: 'Recent replies to the organization\'s outreach campaigns with sender, subject, sentiment classification, and snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationId: { type: 'string' },
        limit: { type: 'number', description: 'Max replies to return (default 20, max 100)' },
      },
      required: ['organisationId'],
    },
    schema: z.object({ organisationId: z.string(), limit: z.number().int().min(1).max(100).optional() }),
    handler: async (a: { organisationId: string; limit?: number }) => {
      const params = new URLSearchParams({ organisationId: a.organisationId, size: String(a.limit ?? 20), page: '0' });
      return await qp(`/api/replies?${params.toString()}`);
    },
  },
  {
    name: 'list_email_accounts',
    description: 'Connected mailboxes (Gmail / Microsoft / custom SMTP/IMAP) with health, daily-send limit, and warmup status.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationId: { type: 'string' },
      },
      required: ['organisationId'],
    },
    schema: z.object({ organisationId: z.string() }),
    handler: async (a: { organisationId: string }) => {
      return await qp(`/email-accounts?organisationId=${encodeURIComponent(a.organisationId)}`);
    },
  },
  {
    name: 'get_credit_balance',
    description: 'Remaining credits, usage this cycle, and plan tier for the organization.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationId: { type: 'string' },
      },
      required: ['organisationId'],
    },
    schema: z.object({ organisationId: z.string() }),
    handler: async (a: { organisationId: string }) => {
      return await qp(`/api/payments/balance?organisationId=${encodeURIComponent(a.organisationId)}`);
    },
  },
];

// ─────────────────────────── Server wiring ───────────────────────────

const server = new Server(
  { name: 'quickprosp-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find(t => t.name === req.params.name);
  if (!tool) {
    return asText({ error: `Unknown tool: ${req.params.name}` });
  }
  try {
    const args = tool.schema.parse(req.params.arguments ?? {});
    const result = await tool.handler(args as any);
    return asText(result);
  } catch (err: any) {
    return asText({ error: err?.message ?? String(err) });
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`QuickProsp MCP server v0.1.0 connected (API: ${API_BASE})`);
