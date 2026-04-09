# Plan Share Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a share button to published L1 plans that copies a public link, and create a standalone read-only page at `/share/plan` that displays the latest published plan with market switching, search, column settings, and multiple view modes.

**Architecture:** New Next.js route `/share/plan/page.tsx` as a standalone page. Data loaded from shared mock constants (extracted to a shared module). Share button added in main app's `renderActionButtons()` area. URL params `projectId` and `level` drive the share page behavior.

**Tech Stack:** Next.js 14 file-based routing, React 18, Ant Design 6, existing PlanModule components (TaskTable, HorizontalTable, GanttChart), DHTMLX Gantt.

---

### Task 1: Extract shared data to a reusable module

The share page needs access to `initialProjects` and market plan data, which currently live inside the `Home` component in `page.tsx`. Extract project data to a shared module so both pages can import it.

**Files:**
- Create: `src/data/projects.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/data/projects.ts`**

Move the `initialProjects` array and related constants (`PROJECT_TYPES`, `PROJECT_STATUS_CONFIG`, `mapIpmStatus`) out of `page.tsx` into a shared data file. Also export a helper to build initial market plan data.

```typescript
// src/data/projects.ts
import { LEVEL1_TASKS, FIXED_LEVEL2_PLANS } from '@/components/plan/PlanModule'

// 项目类型选项
export const PROJECT_TYPES = ['整机产品项目', '产品项目', '技术项目', '能力建设项目']

// 项目类型标签颜色
export const PROJECT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  '整机产品项目': { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  '产品项目': { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' },
  '技术项目': { bg: 'rgba(250,173,20,0.08)', color: '#d48806' },
  '能力建设项目': { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' },
}

// IPM状态 → PMS展示状态 映射
export const mapIpmStatus = (ipmStatus: string, projectType: string): string => {
  const mapping: Record<string, string> = {
    '筹备中': '待立项', '进行中': '进行中', '已完成': '已完成', '已取消': '已取消', '维护期': '维护',
  }
  if (projectType === '整机产品项目' && ipmStatus === '已上市') return '已上市'
  if (projectType === '技术项目' && ipmStatus === '待立议') return '待立议'
  if (projectType === '技术项目' && ipmStatus === '待验') return '待验'
  return mapping[ipmStatus] || ipmStatus
}

// 项目状态颜色配置
export const PROJECT_STATUS_CONFIG: Record<string, { color: string; tagColor: string }> = {
  '待立项': { color: '#faad14', tagColor: 'warning' },
  '待立议': { color: '#faad14', tagColor: 'warning' },
  '进行中': { color: '#1890ff', tagColor: 'processing' },
  '已完成': { color: '#52c41a', tagColor: 'success' },
  '已上市': { color: '#722ed1', tagColor: 'purple' },
  '维护': { color: '#13c2c2', tagColor: 'cyan' },
  '暂停': { color: '#d9d9d9', tagColor: 'default' },
  '已取消': { color: '#ff4d4f', tagColor: 'error' },
  '待验': { color: '#faad14', tagColor: 'warning' },
  '筹备中': { color: '#faad14', tagColor: 'warning' },
}

// 项目数据 — paste the full initialProjects array here (all 7 projects)
export const initialProjects = [
  // ... exact copy of the initialProjects array from page.tsx lines 337-530
]

// 构建市场计划数据
export function buildMarketPlanData(markets: string[]) {
  const data: Record<string, { tasks: any[], level2Tasks: any[], createdLevel2Plans: { id: string, name: string, type: string }[] }> = {}
  markets.forEach(m => {
    data[m] = { tasks: [...LEVEL1_TASKS.map(t => ({ ...t }))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] }
  })
  return data
}
```

- [ ] **Step 2: Update `page.tsx` to import from shared data module**

Replace the inline `initialProjects`, `PROJECT_TYPES`, `PROJECT_STATUS_CONFIG`, `mapIpmStatus` definitions in `page.tsx` with imports from `@/data/projects`.

```typescript
// At top of page.tsx, add:
import { initialProjects, PROJECT_TYPES, PROJECT_STATUS_CONFIG, mapIpmStatus, buildMarketPlanData } from '@/data/projects'

// Remove the inline definitions of these constants (lines ~307-410 and ~373-409)
// Keep all other code unchanged
```

Also update the marketPlanData initializer to use the helper:
```typescript
// Replace lines 782-786:
const [marketPlanData, setMarketPlanData] = useState(() => buildMarketPlanData(['OP', 'TR', 'RU']))
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify dev server works**

Run: Open http://localhost:3004 and confirm the main app still works identically.

- [ ] **Step 5: Commit**

```bash
git add src/data/projects.ts src/app/page.tsx
git commit -m "refactor: extract shared project data to src/data/projects.ts"
```

---

### Task 2: Add share button to L1 plan toolbar

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `ShareAltOutlined` to the icon imports**

In the `@ant-design/icons` import block (around line 134-257), add `ShareAltOutlined`:

```typescript
import {
  // ... existing imports ...
  ShareAltOutlined,
} from '@ant-design/icons'
```

- [ ] **Step 2: Add share button after `renderActionButtons()` call**

Find line 3795 where `{renderActionButtons()}` is rendered. Add the share button right after it, inside the same `<Space>`. The button should only show when:
- The plan level is level1 (`projectPlanLevel === 'level1'`)
- At least one published version exists
- Current user has L1 view permission

```typescript
// Replace line 3795:
{renderActionButtons()}

// With:
{renderActionButtons()}
{projectPlanLevel === 'level1' && versions.some(v => v.status === '已发布') && (
  <Tooltip title="复制分享链接，无需权限即可查看">
    <Button
      icon={<ShareAltOutlined />}
      onClick={() => {
        const url = `${window.location.origin}/share/plan?projectId=${selectedProject?.id}&level=level1`
        navigator.clipboard.writeText(url).then(() => {
          message.success('分享链接已复制到剪贴板')
        })
      }}
    >
      分享
    </Button>
  </Tooltip>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify in browser**

Open http://localhost:3004, navigate to a project's L1 plan (published version). Confirm:
- Share button appears next to ActionButtons
- Clicking it copies a URL like `http://localhost:3004/share/plan?projectId=1&level=level1`
- `message.success` toast appears

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add share button to L1 plan toolbar"
```

---

### Task 3: Create the share page

**Files:**
- Create: `src/app/share/plan/page.tsx`

- [ ] **Step 1: Create the share page file**

Create `src/app/share/plan/page.tsx` with the full implementation. This is a `'use client'` page that:

1. Reads `projectId` and `level` from URL search params
2. Loads project data from the shared data module
3. Shows header info bar (project name · 一级计划, type tag, version, SPM)
4. Shows toolbar (market tabs for 整机, search, column settings, view switcher)
5. Renders read-only plan views (TaskTable / HorizontalTable / GanttChart)

```typescript
'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card, Tag, Space, Input, Button, Tooltip, Modal, Checkbox, Empty, Segmented, Divider, Row, Col
} from 'antd'
import {
  SearchOutlined, AppstoreOutlined, BarChartOutlined, TableOutlined,
  UnorderedListOutlined, SettingOutlined
} from '@ant-design/icons'
import { initialProjects, PROJECT_TYPE_COLORS, buildMarketPlanData } from '@/data/projects'
import { TaskTable, HorizontalTable, GanttChart, ALL_COLUMNS, VERSION_DATA, LEVEL1_TASKS } from '@/components/plan/PlanModule'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'

function SharePlanContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const level = searchParams.get('level') || 'level1'
  const planType = searchParams.get('planType') || ''

  // Find project
  const project = initialProjects.find(p => p.id === projectId)

  // Versions — use published only
  const publishedVersions = VERSION_DATA.filter(v => v.status === '已发布')
  const latestVersion = publishedVersions.sort((a, b) => {
    const aNum = parseInt(a.versionNo.replace('V', ''))
    const bNum = parseInt(b.versionNo.replace('V', ''))
    return bNum - aNum
  })[0]

  // Is 整机产品项目 with markets?
  const isWholeMachine = project?.type === '整机产品项目' && project?.markets && project.markets.length > 0
  const markets = isWholeMachine ? (project.markets as string[]) : []

  // Market plan data for 整机项目
  const allMarketData = useMemo(() => {
    if (!isWholeMachine) return null
    return buildMarketPlanData(markets)
  }, [isWholeMachine, markets.join(',')])

  // State
  const [selectedMarket, setSelectedMarket] = useState(markets[0] || '')
  const [viewMode, setViewMode] = useState<'table' | 'horizontal' | 'gantt'>('table')
  const [searchText, setSearchText] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  const [showColumnModal, setShowColumnModal] = useState(false)
  const [tempColumns, setTempColumns] = useState<string[]>([])

  // Current tasks based on market selection
  const tasks = useMemo(() => {
    if (isWholeMachine && allMarketData && selectedMarket) {
      return allMarketData[selectedMarket]?.tasks || [...LEVEL1_TASKS]
    }
    return [...LEVEL1_TASKS]
  }, [isWholeMachine, allMarketData, selectedMarket])

  // Plan title
  const planTitle = level === 'level1' ? '一级计划' : planType || '二级计划'

  // Error states
  if (!projectId || !project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <Empty description={<span style={{ color: '#9ca3af', fontSize: 14 }}>项目不存在或链接无效</span>} />
        </Card>
      </div>
    )
  }

  if (!latestVersion) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <Empty description={<span style={{ color: '#9ca3af', fontSize: 14 }}>该项目暂无已发布的计划</span>} />
        </Card>
      </div>
    )
  }

  const typeColor = PROJECT_TYPE_COLORS[project.type] || { bg: 'rgba(140,140,140,0.08)', color: '#8c8c8c' }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
      {/* Header Info Bar */}
      <Card
        size="small"
        style={{
          marginBottom: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(238,242,255,0.8))',
          border: '1px solid rgba(99,102,241,0.1)',
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space size={12}>
            <Tag style={{ fontSize: 12, borderRadius: 4, background: typeColor.bg, color: typeColor.color, border: 'none', padding: '2px 10px' }}>
              {project.type}
            </Tag>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {project.type === '整机产品项目' && (project as any).marketName ? (project as any).marketName : project.name}
              <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>·</span>
              <span style={{ color: '#6366f1', marginLeft: 8 }}>{planTitle}</span>
            </span>
          </Space>
          <Space size={16} split={<Divider type="vertical" style={{ margin: 0, borderColor: 'rgba(99,102,241,0.15)' }} />}>
            <Space size={4}>
              <Tag color="green" style={{ fontSize: 12 }}>{latestVersion.versionNo}</Tag>
              <Tag color="success" style={{ fontSize: 11 }}>已发布</Tag>
            </Space>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>SPM: {(project as any).spm || '-'}</span>
          </Space>
        </div>
      </Card>

      {/* Toolbar */}
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 10 }}
        styles={{ body: { padding: '8px 16px' } }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space size={8}>
              {/* Market tabs for 整机产品项目 */}
              {isWholeMachine && markets.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 3px', background: 'rgba(99,102,241,0.05)', borderRadius: 8 }}>
                    {markets.map(m => (
                      <div
                        key={m}
                        onClick={() => setSelectedMarket(m)}
                        style={{
                          padding: '4px 14px', borderRadius: 6, cursor: 'pointer',
                          fontSize: 13, fontWeight: selectedMarket === m ? 600 : 400,
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          background: selectedMarket === m ? '#fff' : 'transparent',
                          color: selectedMarket === m ? '#4338ca' : '#9ca3af',
                          boxShadow: selectedMarket === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                  <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'rgba(99,102,241,0.12)' }} />
                </>
              )}
              <Input
                placeholder="搜索任务..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                style={{ width: 200, borderRadius: 6 }}
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
              />
              {viewMode === 'table' && (
                <Tooltip title="自定义列">
                  <Button
                    icon={<SettingOutlined />}
                    style={{ borderRadius: 6 }}
                    onClick={() => { setTempColumns([...visibleColumns]); setShowColumnModal(true) }}
                  />
                </Tooltip>
              )}
            </Space>
          </Col>
          <Col>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as any)}
              options={[
                { label: <Space size={4}><TableOutlined />竖版表格</Space>, value: 'table' },
                { label: <Space size={4}><UnorderedListOutlined />横版表格</Space>, value: 'horizontal' },
                { label: <Space size={4}><BarChartOutlined />甘特图</Space>, value: 'gantt' },
              ]}
              style={{ borderRadius: 8 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Content Area */}
      <Card style={{ borderRadius: 10 }} styles={{ body: { padding: viewMode === 'horizontal' ? 0 : undefined } }}>
        {viewMode === 'table' && (
          <TaskTable
            tasks={tasks}
            setTasks={() => {}}
            isEditMode={false}
            isCurrentDraft={false}
            visibleColumns={visibleColumns}
            searchText={searchText}
            activeModule="share"
            planLevel="level1"
            projectPlanLevel="level1"
            activeLevel2Plan=""
            level2PlanTasks={[]}
            setLevel2PlanTasks={() => {}}
          />
        )}
        {viewMode === 'horizontal' && (
          <HorizontalTable tasks={tasks} versions={publishedVersions} />
        )}
        {viewMode === 'gantt' && (
          <GanttChart tasks={tasks} isEditMode={false} />
        )}
      </Card>

      {/* Column Settings Modal */}
      <Modal
        title="自定义列显示"
        open={showColumnModal}
        onOk={() => { setVisibleColumns(tempColumns); setShowColumnModal(false) }}
        onCancel={() => setShowColumnModal(false)}
        width={480}
        className="pms-modal"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 0' }}>
          {ALL_COLUMNS.map(col => (
            <Checkbox
              key={col.key}
              checked={tempColumns.includes(col.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  setTempColumns([...tempColumns, col.key])
                } else {
                  setTempColumns(tempColumns.filter(k => k !== col.key))
                }
              }}
            >
              {col.title}
            </Checkbox>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default function SharePlanPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 80px' }}>
          <span style={{ color: '#9ca3af' }}>加载中...</span>
        </Card>
      </div>
    }>
      <SharePlanContent />
    </Suspense>
  )
}
```

Key points:
- Wrapped in `<Suspense>` because `useSearchParams()` requires it in Next.js 14
- All three view components reused with read-only props
- Market switching via local state, uses `buildMarketPlanData()` from shared module
- Column settings modal replicates the main app pattern
- No permission checks — fully public page

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test the share page**

1. Open http://localhost:3004/share/plan?projectId=1&level=level1
   - Should show X6877 project's L1 plan with market tabs (OP/TR/RU)
   - Test switching markets, searching, changing views
2. Open http://localhost:3004/share/plan?projectId=2&level=level1
   - Should show tOS16.0 project's L1 plan WITHOUT market tabs
3. Open http://localhost:3004/share/plan?projectId=999&level=level1
   - Should show "项目不存在" empty state
4. Open http://localhost:3004/share/plan
   - Should show "项目不存在" empty state (no projectId)

- [ ] **Step 4: Commit**

```bash
git add src/app/share/plan/page.tsx
git commit -m "feat: create standalone share page for L1 plan"
```

---

### Task 4: End-to-end verification and final commit

**Files:**
- All files from Tasks 1-3

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: End-to-end flow test**

1. Open main app → go to project X6877 → L1 plan → published version
2. Confirm "分享" button appears next to ActionButtons
3. Click "分享" → confirm toast "分享链接已复制到剪贴板"
4. Paste the copied URL into a new browser tab
5. Confirm the share page loads with:
   - Header: type tag + "NOTE 50 Pro · 一级计划" + V3 已发布 + SPM
   - Market tabs: OP / TR / RU
   - Default view: 竖版表格 with all tasks
   - Switch to 横版表格: horizontal matrix with published versions
   - Switch to 甘特图: Gantt chart rendered
   - Search: filters tasks by name/responsible
   - Column settings: modal to toggle columns
   - Switch market: tasks update

- [ ] **Step 3: Verify draft-only project has no share button**

Navigate to a project with only draft versions (if any). Confirm the share button does NOT appear.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "feat: plan share feature complete — share button + standalone page"
```
