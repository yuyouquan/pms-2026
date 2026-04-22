# PMS-2026 MCP Server

A Model Context Protocol server that exposes PMS-2026 data (projects, versions, plans) to any MCP-compatible AI client — Claude Desktop, chat.transsion.com, etc.

## Run locally

```bash
npm run mcp
```

The server listens on stdio. For development/testing, you can pipe a JSON-RPC request to it:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx mcp-server/server.ts
```

## Configure in Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pms-2026": {
      "command": "npx",
      "args": ["tsx", "/Users/shswyuyouquan/Documents/work/pms-2026-ai-chat/mcp-server/server.ts"],
      "cwd": "/Users/shswyuyouquan/Documents/work/pms-2026-ai-chat"
    }
  }
}
```

Adjust paths to match your environment. Restart Claude Desktop — "pms-2026" appears in the MCP panel.

## Exposed Tools

| Tool | Purpose |
|---|---|
| `query_versions` | 版本发布列表（可过滤项目 + 时间范围）|
| `query_version_compare` | 对比某项目最近两个成功版本 |
| `query_product` | 产品规格（X6877 啥产品）|
| `query_plans_l1` | 一级计划 / 里程碑 |
| `query_plans_l2` | 二级计划（可过滤需求开发/版本火车/独立应用/测试）|
| `query_plans_l3` | 三级计划（按部门拆分）|
| `query_project_basic` | 项目基础信息 |
| `list_projects` | 列出所有项目 |

## Example queries in Claude Desktop

- "本周 PMS 发了几个版本？"
- "X6877-D8400_H991 的最新稳定性怎么样？"
- "对比一下 6877 最近两个版本"
- "6877 的里程碑计划"
- "6877 的版本火车二级计划"
