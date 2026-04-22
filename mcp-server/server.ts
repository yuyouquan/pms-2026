#!/usr/bin/env -S npx tsx
/**
 * PMS-2026 MCP Server
 *
 * Exposes PMS data (projects, versions, plans) to MCP-compatible AI clients
 * (Claude Desktop, chat.transsion.com, etc).
 *
 * Run: `npx tsx mcp-server/server.ts`
 * Configure in Claude Desktop: see mcp-server/README.md
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { initialProjects, PROJECT_MEMBER_MAP } from './pms-data'
import {
  MOCK_VERSIONS,
  MOCK_PRODUCT_SPECS,
  MOCK_LEVELED_PLANS,
} from '../src/mock/ai-extended'

// ─── Helpers ──────────────────────────────────────────────────

function resolveProject(nameOrId: string) {
  return initialProjects.find(p => p.name === nameOrId || p.id === nameOrId)
}

function hasAccess(userName: string, projectName: string): boolean {
  const p = resolveProject(projectName)
  if (!p) return false
  const members = PROJECT_MEMBER_MAP[p.id] ?? []
  return members.includes(userName)
}

// ─── Server setup ──────────────────────────────────────────────

const server = new Server(
  { name: 'pms-2026', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// ─── Tool definitions ────────────────────────────────────────

const TOOLS = [
  {
    name: 'query_versions',
    description: '查询版本发布列表。支持按项目名和时间范围过滤。老板可直接问"本周发了几个版本"、"6877 最新版本"。',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: '项目名（可选，不填则返回全部项目）' },
        days_back: { type: 'number', description: '时间范围（近 N 天），默认 14 天', default: 14 },
      },
    },
  },
  {
    name: 'query_version_compare',
    description: '对比某项目最近两个成功版本的稳定性/性能/缺陷数。',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: '项目名' } },
      required: ['project'],
    },
  },
  {
    name: 'query_product',
    description: '查询产品规格，如 "X6877 是啥产品"。',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: '项目名或产品代号' } },
      required: ['project'],
    },
  },
  {
    name: 'query_plans_l1',
    description: '查询一级计划（里程碑）。',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' } },
      required: ['project'],
    },
  },
  {
    name: 'query_plans_l2',
    description: '查询二级计划（主计划）。可按分类过滤（需求开发/版本火车/独立应用/测试）。',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        category: { type: 'string', enum: ['需求开发', '版本火车', '独立应用', '测试'] },
      },
      required: ['project'],
    },
  },
  {
    name: 'query_plans_l3',
    description: '查询三级计划（部门拆分）。可按部门过滤。',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        department: { type: 'string' },
      },
      required: ['project'],
    },
  },
  {
    name: 'query_project_basic',
    description: '查询项目基础信息（SPM/排期/状态/描述）。',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' } },
      required: ['project'],
    },
  },
  {
    name: 'list_projects',
    description: '列出所有项目及其简要信息（名称、类型、状态、SPM）。',
    inputSchema: { type: 'object', properties: {} },
  },
]

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

// ─── Tool call handler ────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  const text = (obj: unknown) => ({
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
  })

  try {
    switch (name) {
      case 'query_versions': {
        const project = args?.project as string | undefined
        const days = (args?.days_back as number | undefined) ?? 14
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
        let items = MOCK_VERSIONS.filter(v => new Date(v.releaseDate).getTime() >= cutoff)
        if (project) items = items.filter(v => v.projectName === project)
        const success = items.filter(v => v.status === 'success').length
        const failed = items.filter(v => v.status === 'failed').length
        return text({
          total: items.length, success, failed,
          success_rate: items.length > 0 ? Math.round((success / items.length) * 100) : 0,
          versions: items,
        })
      }

      case 'query_version_compare': {
        const project = args?.project as string
        const versions = MOCK_VERSIONS
          .filter(v => v.projectName === project && v.status === 'success')
          .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
        if (versions.length < 2) {
          return text({ error: `${project} 可对比成功版本不足 2 个` })
        }
        const [b, a] = [versions[0], versions[1]]
        return text({
          newer: b, older: a,
          stability_delta: b.stabilityScore - a.stabilityScore,
          perf_delta: b.perfScore - a.perfScore,
          defect_delta: b.defectCount - a.defectCount,
        })
      }

      case 'query_product': {
        const project = args?.project as string
        const spec = MOCK_PRODUCT_SPECS[project]
          ?? Object.values(MOCK_PRODUCT_SPECS).find(s => s.codename === project)
        if (!spec) return text({ error: `${project} 未找到产品规格` })
        return text(spec)
      }

      case 'query_plans_l1': {
        const project = args?.project as string
        const plans = MOCK_LEVELED_PLANS.filter(p => p.projectName === project && p.level === 'L1')
        return text({ project, count: plans.length, plans })
      }

      case 'query_plans_l2': {
        const project = args?.project as string
        const category = args?.category as string | undefined
        let plans = MOCK_LEVELED_PLANS.filter(p => p.projectName === project && p.level === 'L2')
        if (category) plans = plans.filter(p => p.category === category)
        return text({ project, category: category ?? 'all', count: plans.length, plans })
      }

      case 'query_plans_l3': {
        const project = args?.project as string
        const department = args?.department as string | undefined
        let plans = MOCK_LEVELED_PLANS.filter(p => p.projectName === project && p.level === 'L3')
        if (department) plans = plans.filter(p => p.department === department)
        return text({ project, department: department ?? 'all', count: plans.length, plans })
      }

      case 'query_project_basic': {
        const project = args?.project as string
        const p = resolveProject(project)
        if (!p) return text({ error: `${project} 未找到` })
        return text({
          id: p.id, name: p.name, type: p.type, status: p.status, progress: p.progress,
          leader: p.leader, spm: p.spm, tosVersion: p.tosVersion, androidVersion: p.androidVersion,
          plan_start: p.planStartDate, plan_end: p.planEndDate, markets: p.markets,
          current_node: p.currentNode, launch_date: p.launchDate,
        })
      }

      case 'list_projects': {
        return text({
          count: initialProjects.length,
          projects: initialProjects.map(p => ({
            id: p.id, name: p.name, type: p.type, status: p.status, spm: p.spm,
          })),
        })
      }

      default:
        return text({ error: `unknown tool: ${name}` })
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: ${e?.message ?? String(e)}` }], isError: true }
  }
})

// ─── Start ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[PMS-MCP] Server started on stdio')
}

main().catch(e => {
  console.error('[PMS-MCP] Fatal error:', e)
  process.exit(1)
})
