# Plan Task Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Feishu notification stubs for the project-space L1 plan: detect task creation/modification on revision publish and detect due-soon/overdue tasks on page entry, then notify responsible persons via a stub module that production will replace with real Feishu IM calls.

**Architecture:** One new types file and one new stub library encapsulate everything Feishu-related. `src/app/page.tsx` adds a small amount of state (`publishedSnapshots`, a ref for session-level dedupe), two pure helper functions (`diffTasksForNotify`, `scanDueTasks`), an extended `handlePublish`, and a new `useEffect` that scans on project entry. The stub module aggregates per-responsible-person and calls a `sendFeishuMessage` function whose body is currently a `console.log` with a `TODO[feishu]` marker.

**Tech Stack:** Next.js 14 + React 18 + Ant Design 6.3.1 + TypeScript + dayjs. **No test framework** — verification = `npx tsc --noEmit` + `npm run build` + manual browser verification.

**Reference spec:** `docs/superpowers/specs/2026-04-10-plan-task-notifications-design.md`

**Before starting:** Read the spec once. Also read:
- `src/app/page.tsx` lines 1993–2035 (current `handleCreateRevision` and `handlePublish`)
- `src/app/page.tsx` lines 683–685 (project-space state declarations near `projectPlanLevel`)
- `src/app/page.tsx` lines 1070–1210 (helper region where new helpers will live)
- `tsconfig.json` — `@/*` path alias maps to `./src/*`, so `@/lib/feishu-notify` and `@/types/plan-notify` resolve correctly

---

## File Structure

**Create:**
- `src/types/plan-notify.ts` — `TaskChange`, `PlanDueNotice`, `PlanChangeKind`, `FeishuRecipient` types
- `src/lib/feishu-notify.ts` — `sendFeishuMessage`, `notifyPublishChanges`, `notifyDueTasks`, `fieldLabel` + file-header integration notes

**Modify:**
- `src/app/page.tsx` — add `notification` to antd imports; add `MOCK_USER_MAP` / `NOTIFY_DIFF_FIELDS` module constants; add `publishedSnapshots` state + `lastDueCheckedProjectRef`; add `diffTasksForNotify` + `scanDueTasks` helpers; extend `handlePublish`; add due-check `useEffect`

---

## Task 1: Create the types file

**Files:**
- Create: `src/types/plan-notify.ts`

- [ ] **Step 1: Create `src/types/plan-notify.ts`**

Create the file with exactly this content:

```ts
// Plan task notification types (added 2026-04-10)
// Shared between page.tsx (detection) and src/lib/feishu-notify.ts (delivery)

export type PlanChangeKind = 'created' | 'modified'

export interface TaskChange {
  kind: PlanChangeKind
  task: any
  previous?: any
  changedFields?: string[]
}

export interface PlanDueNotice {
  kind: 'due_soon' | 'overdue'
  task: any
  daysUntilDue: number  // negative means already overdue by |daysUntilDue| days
}

export interface FeishuRecipient {
  openId: string
  email: string
  name: string
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors. (The types are unused so far; TS does not warn on unused exports in this project.)

- [ ] **Step 3: Commit**

```bash
git add src/types/plan-notify.ts
git commit -m "feat(notify): add plan-notify shared types"
```

---

## Task 2: Create the Feishu stub module

**Files:**
- Create: `src/lib/feishu-notify.ts`

- [ ] **Step 1: Create `src/lib/feishu-notify.ts`**

Create the file with exactly this content:

```ts
// src/lib/feishu-notify.ts
//
// 飞书通知 stub 模块
//
// ============================================================
// 生产环境集成步骤
// ============================================================
//
//   1. 将 sendFeishuMessage() 的实现从 console.log 替换为真实 IM 调用
//      推荐通过后端代理（前端不持有 app_secret）：
//        POST /api/feishu/send-message
//          body: { open_id, subject, body }
//      后端使用 tenant_access_token 调用:
//        https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
//
//   2. 替换 MOCK_USER_MAP 为真实通讯录查询。调用方传入 userMap 参数即可，
//      本模块本身不持有 MOCK_USER_MAP。
//
//   3. 到期提醒的 notifyDueTasks 在生产环境应由后端每日定时任务触发
//      （例如每天凌晨 0:00 或每 6 小时一次），前端仅在用户进入项目空间 L1
//      页面时调用一次作为 mock 展示。
//
// 参考文档：
//   https://open.feishu.cn/document/server-docs/im-v1/message/create
// ============================================================

import type { TaskChange, PlanDueNotice, FeishuRecipient } from '@/types/plan-notify'

/**
 * 发送单条飞书消息 stub。
 * 生产环境应替换为真实 IM 调用，通常通过后端代理。
 */
export async function sendFeishuMessage(
  recipient: FeishuRecipient,
  subject: string,
  body: string
): Promise<void> {
  // TODO[feishu]: 替换下面的 console.log 为真实 IM 调用
  // 例如：
  //   await fetch('/api/feishu/send-message', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ open_id: recipient.openId, subject, body }),
  //   })
  console.log(
    `[Feishu stub] → ${recipient.name} (${recipient.openId})\n  主题: ${subject}\n  正文:\n${body.split('\n').map(l => '    ' + l).join('\n')}`
  )
}

/**
 * 发布变更通知：按责任人聚合 changes 后逐人发送一条合并消息。
 * 返回被通知的人数（供 UI 汇总展示）。
 */
export async function notifyPublishChanges(
  versionNo: string,
  changes: TaskChange[],
  userMap: Record<string, FeishuRecipient>
): Promise<number> {
  const byPerson = new Map<string, TaskChange[]>()
  for (const c of changes) {
    const name = c.task.responsible
    if (!name) continue
    if (!byPerson.has(name)) byPerson.set(name, [])
    byPerson.get(name)!.push(c)
  }

  let notified = 0
  for (const [name, list] of byPerson) {
    const recipient = userMap[name]
    if (!recipient) {
      console.warn(`[Feishu stub] 未在 userMap 中找到 "${name}"，跳过`)
      continue
    }
    const created = list.filter(c => c.kind === 'created')
    const modified = list.filter(c => c.kind === 'modified')
    const lines: string[] = [`您好 ${name}，一级计划 ${versionNo} 已发布，您负责的任务变更如下：`, '']
    if (created.length > 0) {
      lines.push(`【新增 ${created.length} 条】`)
      for (const c of created) {
        lines.push(`  • ${c.task.id} ${c.task.taskName}（${c.task.planStartDate || '-'} ~ ${c.task.planEndDate || '-'}）`)
      }
      lines.push('')
    }
    if (modified.length > 0) {
      lines.push(`【修改 ${modified.length} 条】`)
      for (const c of modified) {
        lines.push(`  • ${c.task.id} ${c.task.taskName}`)
        for (const f of (c.changedFields || [])) {
          const oldVal = c.previous?.[f] ?? '-'
          const newVal = c.task[f] ?? '-'
          lines.push(`    - ${fieldLabel(f)}: ${oldVal} → ${newVal}`)
        }
      }
    }
    await sendFeishuMessage(recipient, `一级计划 ${versionNo} 任务变更`, lines.join('\n'))
    notified++
  }
  return notified
}

/**
 * 到期提醒通知：按责任人聚合 notices 后发送一条合并消息。
 */
export async function notifyDueTasks(
  notices: PlanDueNotice[],
  userMap: Record<string, FeishuRecipient>
): Promise<number> {
  const byPerson = new Map<string, PlanDueNotice[]>()
  for (const n of notices) {
    const name = n.task.responsible
    if (!name) continue
    if (!byPerson.has(name)) byPerson.set(name, [])
    byPerson.get(name)!.push(n)
  }
  let notified = 0
  for (const [name, list] of byPerson) {
    const recipient = userMap[name]
    if (!recipient) {
      console.warn(`[Feishu stub] 未在 userMap 中找到 "${name}"，跳过`)
      continue
    }
    const soon = list.filter(n => n.kind === 'due_soon')
    const overdue = list.filter(n => n.kind === 'overdue')
    const lines: string[] = [`您好 ${name}，以下任务需要您关注：`, '']
    if (overdue.length > 0) {
      lines.push(`【已逾期 ${overdue.length} 条】`)
      for (const n of overdue) {
        lines.push(`  • ${n.task.id} ${n.task.taskName}（计划完成 ${n.task.planEndDate}，已逾期 ${Math.abs(n.daysUntilDue)} 天）`)
      }
      lines.push('')
    }
    if (soon.length > 0) {
      lines.push(`【即将到期 ${soon.length} 条】`)
      for (const n of soon) {
        lines.push(`  • ${n.task.id} ${n.task.taskName}（计划完成 ${n.task.planEndDate}，剩余 ${n.daysUntilDue} 天）`)
      }
    }
    await sendFeishuMessage(recipient, '一级计划任务到期提醒', lines.join('\n'))
    notified++
  }
  return notified
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    taskName: '任务名称',
    planStartDate: '计划开始',
    planEndDate: '计划完成',
    responsible: '责任人',
    predecessor: '前置任务',
  }
  return labels[field] || field
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/feishu-notify.ts
git commit -m "feat(notify): add Feishu notification stub module with TODO markers"
```

---

## Task 3: Add imports, state, constants to `page.tsx`

**Files:**
- Modify: `src/app/page.tsx` — imports, module constants, component state

- [ ] **Step 1: Add `notification` to the antd import**

Find the antd named-import block at the top of `src/app/page.tsx` (around lines 4–41, starting with `import {` ending with `} from 'antd'`). Add `notification` to the list. The exact addition: insert `  notification,` after the existing `  message,` line. The result should look like:

```ts
import {
  Card,
  Tabs,
  Table,
  Button,
  Progress,
  Tag,
  Space,
  Row,
  Col,
  Badge,
  Menu,
  message,
  notification,
  Select,
  Input,
  ...
```

- [ ] **Step 2: Import notify module + types**

Find the project-local imports block (around lines 46–50, containing `import { PermissionConfig, ... } from '@/components/permission/PermissionModule'`). After the last project-local import, add:

```ts
import { notifyPublishChanges, notifyDueTasks } from '@/lib/feishu-notify'
import type { TaskChange, PlanDueNotice, FeishuRecipient } from '@/types/plan-notify'
```

- [ ] **Step 3: Add module-level constants**

Find a module-level location that's OUTSIDE the `Home` component but INSIDE the file — a natural spot is just above the `export default function Home()` declaration (around line 580–600 area; search for `export default function Home`). Above that function, add:

```ts
const NOTIFY_DIFF_FIELDS = ['taskName', 'planStartDate', 'planEndDate', 'responsible', 'predecessor'] as const

// Mock 责任人 → 飞书用户映射
// TODO[feishu]: 生产环境从组织通讯录查询真实 open_id / email，并按需扩展覆盖范围
const MOCK_USER_MAP: Record<string, FeishuRecipient> = {
  '张三': { openId: 'ou_mock_zhangsan', email: 'zhangsan@transsion.com', name: '张三' },
  '李四': { openId: 'ou_mock_lisi',     email: 'lisi@transsion.com',     name: '李四' },
  '王五': { openId: 'ou_mock_wangwu',   email: 'wangwu@transsion.com',   name: '王五' },
  '赵六': { openId: 'ou_mock_zhaoliu',  email: 'zhaoliu@transsion.com',  name: '赵六' },
  '孙七': { openId: 'ou_mock_sunqi',    email: 'sunqi@transsion.com',    name: '孙七' },
  '周八': { openId: 'ou_mock_zhouba',   email: 'zhouba@transsion.com',   name: '周八' },
  '吴九': { openId: 'ou_mock_wujiu',    email: 'wujiu@transsion.com',    name: '吴九' },
}
```

If there's already a different module-level constant near the top of the file (like `LEVEL1_TASKS` or `VERSION_DATA`), you can add these alongside them. Don't place them inside the `Home` component body — they'd be re-created every render.

- [ ] **Step 4: Add `publishedSnapshots` state and `lastDueCheckedProjectRef`**

Find the component state declarations, specifically the block near `projectPlanLevel` / `projectPlanViewMode` (around line 683–684). Immediately after the existing `projectPlanViewMode` declaration, add:

```ts
// 已发布版本的任务快照（供发布变更 diff 的 baseline，和到期扫描的数据源）
const [publishedSnapshots, setPublishedSnapshots] = useState<Record<string, any[]>>({})
// Session-level 去重：同一项目在 session 内到期扫描只跑一次
const lastDueCheckedProjectRef = useRef<string | null>(null)
```

`useRef` is already imported at the top of the file (line 3: `import { useState, useMemo, useEffect, useRef, ... }`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. The new types and state are not yet consumed by logic, but TypeScript allows unused locals.

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(notify): wire imports, constants, and state for plan notifications"
```

---

## Task 4: Add `diffTasksForNotify` and `scanDueTasks` helpers

**Files:**
- Modify: `src/app/page.tsx` — new helper functions inside `Home` component

- [ ] **Step 1: Locate insertion point**

Find an existing helper in the `Home` component body. A good anchor is the `getAllExpandableIds` helper (added in the prior expand/collapse feature, currently around line 1221). The new helpers will go in the same region so all plan-related helpers stay together.

- [ ] **Step 2: Insert both helpers**

Right after the closing brace of `collapseAll` (the last of the expand/collapse helpers), add:

```ts
// ============================================================
// Plan task notification helpers (added 2026-04-10)
// ============================================================

const diffTasksForNotify = (baseline: any[], current: any[]): TaskChange[] => {
  const baselineMap = new Map<string, any>(baseline.map(t => [t.id, t]))
  const changes: TaskChange[] = []
  for (const curr of current) {
    const prev = baselineMap.get(curr.id)
    if (!prev) {
      changes.push({ kind: 'created', task: curr })
      continue
    }
    const changedFields: string[] = []
    for (const f of NOTIFY_DIFF_FIELDS) {
      if ((prev[f] ?? '') !== (curr[f] ?? '')) {
        changedFields.push(f)
      }
    }
    if (changedFields.length > 0) {
      changes.push({ kind: 'modified', task: curr, previous: prev, changedFields })
    }
  }
  return changes
}

const scanDueTasks = (taskList: any[]): PlanDueNotice[] => {
  const today = dayjs().startOf('day')
  const notices: PlanDueNotice[] = []
  for (const t of taskList) {
    if (!t.parentId) continue
    if (t.actualEndDate) continue
    if (!t.planEndDate || t.planEndDate === '-') continue
    const due = dayjs(t.planEndDate)
    if (!due.isValid()) continue
    const days = due.startOf('day').diff(today, 'day')
    if (days < 0) {
      notices.push({ kind: 'overdue', task: t, daysUntilDue: days })
    } else if (days <= 2) {
      notices.push({ kind: 'due_soon', task: t, daysUntilDue: days })
    }
  }
  return notices
}
```

`dayjs` is already imported at the top of the file (line 43). `TaskChange` and `PlanDueNotice` were added in Task 3.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(notify): add diffTasksForNotify and scanDueTasks helpers"
```

---

## Task 5: Extend `handlePublish` with diff + snapshot + notify

**Files:**
- Modify: `src/app/page.tsx` — `handlePublish` function (around line 2027–2035)

- [ ] **Step 1: Replace `handlePublish`**

Find the existing `handlePublish` (around line 2027). The current body is:

```ts
const handlePublish = () => {
  // 将当前修订版改为已发布
  setVersions(versions.map(v =>
    v.id === currentVersion
      ? { ...v, status: '已发布' }
      : v
  ))
  message.success('发布成功')
}
```

Replace with:

```ts
const handlePublish = () => {
  // 1. Baseline = 上一个已发布版本的任务快照
  const prevPublished = versions
    .filter(v => v.status === '已发布' && v.id !== currentVersion)
    .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
  const baselineTasks: any[] = prevPublished ? (publishedSnapshots[prevPublished.id] || []) : []

  // 2. 计算变更
  const changes = diffTasksForNotify(baselineTasks, tasks)

  // 3. 将当前修订版改为已发布
  const publishedVersionId = currentVersion
  const publishedVersion = versions.find(v => v.id === publishedVersionId)
  setVersions(versions.map(v =>
    v.id === publishedVersionId
      ? { ...v, status: '已发布' }
      : v
  ))

  // 4. 保存本次发布的任务快照
  setPublishedSnapshots(prev => ({
    ...prev,
    [publishedVersionId]: JSON.parse(JSON.stringify(tasks)),
  }))

  // 5. 发送飞书通知（stub），并弹出 UI 汇总提示
  const versionNo = publishedVersion?.versionNo || publishedVersionId
  if (changes.length > 0) {
    notifyPublishChanges(versionNo, changes, MOCK_USER_MAP).then(notified => {
      if (notified > 0) {
        notification.info({
          message: '已通过飞书通知责任人',
          description: `一级计划 ${versionNo} 发布，共 ${changes.length} 条变更，已通知 ${notified} 位责任人（详情见浏览器控制台）`,
          placement: 'topRight',
          duration: 5,
        })
      }
    })
  }

  message.success('发布成功')
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(notify): extend handlePublish with diff, snapshot, and Feishu notify"
```

---

## Task 6: Add due-check `useEffect`

**Files:**
- Modify: `src/app/page.tsx` — add new useEffect near other project-space effects

- [ ] **Step 1: Insert the effect**

Find a good anchor for the new `useEffect`. The existing effect that syncs `initialProjectType` (around line 92–101) is in the `MilestoneView` component file, not here. In `Home`, search for `// Load saved views` or similar top-level useEffects. A safe anchor: search for `const handleCreateRevision = ` and insert the new useEffect immediately before it (so it lives with other Home-component effects).

Insert this effect:

```ts
// Plan task due-soon/overdue scan (added 2026-04-10)
// 生产环境说明：真实场景由后端每日定时任务触发对所有项目的扫描 + 通知；
// 前端仅在用户进入项目空间 L1 页面时即时扫描一次，作为 mock 演示。
useEffect(() => {
  if (activeModule !== 'projectSpace') return
  if (!selectedProject) return
  if (projectPlanLevel !== 'level1') return

  // Session-level 去重：同一项目只扫描一次
  const key = selectedProject.id
  if (lastDueCheckedProjectRef.current === key) return
  lastDueCheckedProjectRef.current = key

  // 取最新已发布版本的任务快照；若未存在（mock 启动态），fallback 到当前 tasks
  const latestPub = versions
    .filter(v => v.status === '已发布')
    .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
  const scanTarget = latestPub && publishedSnapshots[latestPub.id]
    ? publishedSnapshots[latestPub.id]
    : tasks

  const notices = scanDueTasks(scanTarget)
  if (notices.length === 0) return

  notifyDueTasks(notices, MOCK_USER_MAP).then(notified => {
    if (notified > 0) {
      notification.warning({
        message: '任务到期提醒已推送',
        description: `项目 ${selectedProject.name} 发现 ${notices.length} 条到期/逾期任务，已通知 ${notified} 位责任人`,
        placement: 'topRight',
        duration: 5,
      })
    }
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedProject?.id, projectPlanLevel, activeModule])
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(notify): scan due/overdue tasks on project space L1 entry"
```

---

## Task 7: Manual verification

**Files:** none

- [ ] **Step 1: Ensure dev server is running**

If not already running, start it: `npm run dev`. Open `http://localhost:3000`. Open the browser DevTools Console.

- [ ] **Step 2: Due-check scenario**

Navigate to 项目空间 → 选择任意项目 → 计划 → 一级计划 Tab:

- [ ] Console shows `[Feishu stub]` log entries (at least one, since `LEVEL1_TASKS` contains tasks with `planEndDate` like '2026-01-15' etc — depending on current mock date, some will be overdue or due_soon)
- [ ] Top-right shows a yellow `notification.warning` titled "任务到期提醒已推送"
- [ ] Switch L1 → L2 → L1 within same project: no duplicate notification
- [ ] Switch to different project: new notification fires for that project

- [ ] **Step 3: Publish-change scenario**

Still on project space L1:

- [ ] Click "创建修订" to create a revision (enters edit mode)
- [ ] Modify a task's `任务名称` or `计划完成` date or `责任人`
- [ ] Click "发布"
- [ ] Top-right shows a blue `notification.info` titled "已通过飞书通知责任人"
- [ ] Console shows `[Feishu stub]` log entries with the detailed change descriptions (one per affected responsible person)
- [ ] Description of the notification counts matches number of modified tasks

- [ ] **Step 4: Aggregation scenario**

- [ ] Create another revision, modify 2-3 tasks assigned to the SAME responsible (e.g., 张三)
- [ ] Publish
- [ ] Console should show ONE merged `[Feishu stub]` block for 张三 with all changes listed together (not multiple separate entries)

- [ ] **Step 5: Non-key field scenario**

- [ ] Create revision, edit only a task's `状态` (status) or `进度` (progress) — these are non-key fields
- [ ] Publish
- [ ] Notification should NOT fire (no toast, no console output beyond the `message.success`)

- [ ] **Step 6: Out-of-scope safety**

- [ ] Navigate to 配置中心 → 一级计划模板 → edit something → the notification system should NOT fire (`getScopeKey()` / `activeModule` guard)
- [ ] Navigate to 项目空间 → L2 plan → no notification (due-check only scans L1)

- [ ] **Step 7: Final build check**

```bash
npx tsc --noEmit && npm run build
```

Both must pass.

- [ ] **Step 8: Optional fixup commit**

If the manual pass surfaced issues, fix in small commits.

---

---

## Task 8: Update PRD with notification section (after code verified)

**Files:** remote Feishu doc — `https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh`

This task is performed **after** the code is in place and manually verified (Task 7 passes). The PRD gets a new 3.3.2 section that documents the notification mechanism, with two screenshot placeholders (real screenshots will be captured later via a follow-up puppeteer pass).

- [ ] **Step 1: Capture screenshots for the PRD**

Write a puppeteer script at `screenshots/capture-notify.mjs` that:
1. Loads `http://localhost:3000`, clicks into a project, navigates to 计划 → 一级计划
2. Captures the moment when the `notification.warning` for due tasks appears → save as `screenshots/notify-01-due.png`
3. Enters 创建修订 mode, modifies a task field, clicks 发布, captures the moment when the `notification.info` appears → save as `screenshots/notify-02-publish.png`

Script outline:

```js
import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const wait = ms => new Promise(r => setTimeout(r, ms))

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await wait(1500)

  // Click first project card to enter project space
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ant-card'))
    for (const c of cards) {
      if (/X\d{4}|iOS\d+/.test(c.textContent || '')) { (c).click(); return }
    }
  })
  await wait(1500)

  // Click 计划 sidebar item
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*')).filter(
      el => el.childElementCount === 0 && el.textContent === '计划'
    )
    for (const e of els) {
      const clickable = e.closest('[role="menuitem"], li, button, a, div')
      if (clickable) { (clickable).click(); return }
    }
  })
  await wait(2000)

  // Screenshot 1: due notification should be visible (fires on L1 entry)
  console.log('[1] Capturing due notification')
  await page.screenshot({
    path: path.join(__dirname, 'notify-01-due.png'),
    fullPage: false,
  })

  // Dismiss the notification
  await page.evaluate(() => {
    document.querySelectorAll('.ant-notification-notice-close').forEach(b => (b).click())
  })
  await wait(800)

  // Click 创建修订
  const entered = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      if (b.textContent?.trim() === '创建修订') { (b).click(); return true }
    }
    return false
  })
  console.log('  entered revision:', entered)
  await wait(1500)

  // Modify first task's task name (find first editable input in table)
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.ant-table input.ant-input'))
    if (inputs.length > 0) {
      const el = inputs[0]
      el.focus()
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, '概念启动(修改)')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await wait(500)

  // Click 发布
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const b of btns) {
      if (b.textContent?.trim() === '发布') { (b).click(); return }
    }
  })
  await wait(1500)

  // Screenshot 2: publish notification
  console.log('[2] Capturing publish notification')
  await page.screenshot({
    path: path.join(__dirname, 'notify-02-publish.png'),
    fullPage: false,
  })

  await browser.close()
  console.log('Done')
}

capture().catch(e => { console.error(e); process.exit(1) })
```

Run: `node screenshots/capture-notify.mjs`
Expected: two PNG files created, dev server log shows `[Feishu stub]` entries from the feature running.

- [ ] **Step 2: Upload the 2 screenshots to Feishu**

```bash
lark-cli docs +media-insert --doc "https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh" --file ./screenshots/notify-01-due.png --align center 2>&1 | grep file_token
lark-cli docs +media-insert --doc "https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh" --file ./screenshots/notify-02-publish.png --align center 2>&1 | grep file_token
```

Record the two `file_token` values returned. Call them `DUE_TOKEN` and `PUB_TOKEN`.

- [ ] **Step 3: Insert new 3.3.2 section before the existing one**

Write the new section content to a temp file and use `docs +update --mode insert_before` targeting `#### 3.3.2 编辑模式详细操作`:

Create `/tmp/pms-prd-notify.md` with this exact content (substitute `DUE_TOKEN` and `PUB_TOKEN` with the actual tokens from Step 2):

```markdown
#### 3.3.2 飞书通知机制
**功能描述：** 一级计划的任务变更和到期状态自动通过飞书通知对应的责任人，减少人工跟踪成本。包含两个触发场景。

**场景 A — 发布修订版时的变更通知：**
- **触发时机**：用户点击"发布"按钮将修订版切换为"已发布"状态
- **检测逻辑**：对比本次发布的任务与上一已发布版本快照，识别新增任务（id 不存在于 baseline）和修改任务
- **修改判定字段**：仅以下关键字段的变化触发通知
  - 任务名称（taskName）
  - 计划开始（planStartDate）
  - 计划完成（planEndDate）
  - 责任人（responsible）
  - 前置任务（predecessor）
- **不触发通知的字段**：状态、进度、实际开始/完成/工期 —— 这些属于执行态，不属于计划变更
- **聚合规则**：同一责任人的多条变更合并为一条飞书消息
- **UI 反馈**：右上角弹出 `notification.info` 汇总提示，正文详情在浏览器控制台可查
- **消息示例**：
<callout emoji="bell" background-color="light-blue">
您好 张三，一级计划 V3 已发布，您负责的任务变更如下：

【新增 1 条】
  • 2.3 STR4（2026-02-16 ~ 2026-03-01）

【修改 1 条】
  • 1.1 概念启动
    - 任务名称: 概念启动 → 概念启动(修改)
    - 计划完成: 2026-01-07 → 2026-01-10
</callout>

**场景 B — 任务到期/逾期提醒：**
- **触发时机**（生产环境）：后端每日定时任务（例如凌晨 0 点）扫描所有项目的一级计划最新已发布版本
- **触发时机**（前端 mock）：用户进入项目空间某项目的一级计划 Tab 时即时触发一次；同一项目在同一 session 内不重复触发
- **扫描对象**：最新已发布版本的**叶子任务**（即有 parentId 的里程碑/活动，排除阶段节点）
- **筛选条件**：
  - 实际完成时间（actualEndDate）为空
  - 计划完成时间（planEndDate）已设置且可解析
- **通知规则**：
  - 距离计划完成 ≤ 2 天（今天/明天/后天）→ "即将到期"
  - 已过计划完成时间 → "已逾期"（按天数递增）
- **聚合规则**：同一责任人多条合并为一条
- **UI 反馈**：右上角弹出 `notification.warning` 汇总提示
- **消息示例**：
<callout emoji="alarm_clock" background-color="light-yellow">
您好 李四，以下任务需要您关注：

【已逾期 1 条】
  • 2.1 STR2（计划完成 2026-01-31，已逾期 69 天）

【即将到期 1 条】
  • 2.2 STR3（计划完成 2026-04-12，剩余 2 天）
</callout>

**责任人映射：** 当前代码中 `MOCK_USER_MAP` 用模拟的 open_id 和 email 作为占位。生产环境需要替换为真实的组织通讯录查询（通过 lark-contact API 或内部 HR 系统）。

<callout emoji="warning" background-color="light-red">
**⚠️ 飞书集成占位（待后端替换）**

当前前端代码中的通知发送为 **stub 状态**，仅在浏览器控制台输出消息并弹出 AntD notification。生产环境集成步骤：

1. 替换 `src/lib/feishu-notify.ts` 中的 `sendFeishuMessage()` 实现：从 `console.log` 改为调用后端代理接口 `POST /api/feishu/send-message`（前端不持有 app_secret）
2. 后端代理使用 `tenant_access_token` 调用飞书官方接口：
   `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`
3. 替换 `MOCK_USER_MAP` 为从通讯录查询的真实用户映射
4. 到期提醒的 `notifyDueTasks` 在生产环境应由**后端每日定时任务**触发（例如每天 0:00 或每 6 小时），前端的 `useEffect` 仅作为页面内即时演示
</callout>

**实现位置：**
- Stub 模块：`src/lib/feishu-notify.ts`
- 共享类型：`src/types/plan-notify.ts`
- 集成点：`src/app/page.tsx` 的 `handlePublish` 函数（发布场景）和顶层 `useEffect`（到期扫描）

**发布变更通知截图：**
<image token="PUB_TOKEN" width="3200" height="2000" align="center"/>

**任务到期提醒截图：**
<image token="DUE_TOKEN" width="3200" height="2000" align="center"/>

```

Then run:
```bash
MD=$(cat /tmp/pms-prd-notify.md | sed "s/PUB_TOKEN/<actual-pub-token>/g; s/DUE_TOKEN/<actual-due-token>/g")
lark-cli docs +update --doc "https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh" --mode insert_before --selection-with-ellipsis "#### 3.3.2 编辑模式详细操作" --markdown "$MD"
```

- [ ] **Step 4: Delete the trailing uploaded image blocks**

After insertion, the 2 originally-uploaded trailing images at the end of the doc need to be cleaned up. Use `delete_range` with a selection spanning both images (using their original tokens from Step 2):

```bash
lark-cli docs +update --doc "https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh" --mode delete_range --selection-with-ellipsis '<image token="<PUB_TOKEN>"...<image token="<DUE_TOKEN>" width="3200" height="2000" align="center"/>'
```

(Use the actual tokens; adjust order if DUE was uploaded before PUB.)

- [ ] **Step 5: Verify PRD state**

Run: `lark-cli docs +fetch --doc "https://transsioner.feishu.cn/docx/YkAcd2SXco7HyZxusSIcOJG3nRh" --format pretty 2>&1 | grep -n "3.3.2"`

Expected: output shows `#### 3.3.2 飞书通知机制` as the new heading.

Also run: `lark-cli docs +fetch ... --format pretty 2>&1 | tail -10`
Expected: doc ends with the `文档结束` callout, no trailing image blocks.

- [ ] **Step 6: Commit the capture script (if new)**

```bash
git add screenshots/capture-notify.mjs
git commit -m "docs(notify): add puppeteer capture script for notification screenshots"
```

---

## Rollback

Each task is its own commit. `git log --oneline feature/plan-task-notifications ^master` shows the list. Revert in reverse order if needed.

## Out of Scope (do NOT implement)

- Real Feishu IM API calls
- Backend daily cron
- Notification history / bell icon
- User muting preferences
- Deleted-task notification
- L2 plan notifications
- Config-center template notifications
- Whole-machine-project per-market notification
- Read receipts / interactive cards
