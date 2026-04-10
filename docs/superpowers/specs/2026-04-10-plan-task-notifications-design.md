# 一级计划任务飞书通知设计

- **日期**: 2026-04-10
- **作用域**: 项目空间（`activeModule === 'projectSpace'`）的**一级计划管理**（L1）
- **影响文件**: `src/app/page.tsx` + 新建 `src/lib/feishu-notify.ts` + 新建 `src/types/plan-notify.ts`
- **PRD 同步**: 新增章节 3.3.2 飞书通知机制（后续小节顺延）

## 1. 背景与目标

项目空间的一级计划有两个关键的通知场景：

1. **发布修订版**时，新增或被修改的任务应当及时告知责任人
2. **已发布的最新计划**里，尚未完成的任务在**到期前 2 天内**或**已逾期**时每天提醒责任人

本 feature 实现上述两种场景的**前端检测 + 聚合 + 通知 stub**。真实飞书 IM 调用留作占位，生产环境替换。

**目标**：

- 发布时的变更检测覆盖关键字段（任务名、时间、责任人、前置）
- 到期/逾期的日常扫描覆盖已发布最新版本的叶子任务
- 同一责任人的多条变更聚合为一条通知，避免打扰
- Stub 使用 `console.log` + `notification.info/warning` 提供可验证的反馈
- 代码结构清晰，生产环境替换只需修改 `src/lib/feishu-notify.ts` 一处

**非目标**：

- 真实飞书 IM API 调用
- 后端定时任务（每日扫描由后端承担，前端仅在进入页面时触发一次）
- 通知历史/中心 UI
- 用户免打扰偏好
- 删除任务的通知
- L2 计划 / 配置中心 / 整机项目多市场维度的通知

## 2. 功能规格

### 2.1 场景 A — 发布时的变更通知

触发：用户在修订版状态下点击"发布"按钮（`handlePublish`）。

检测流程：

1. 取上一个"已发布"版本的任务快照（从 `publishedSnapshots[prevVersionId]`，没有则空数组）
2. 对比当前 `tasks`：
   - 新 id → `created`
   - 已有 id 且以下任一关键字段变化 → `modified`：
     - `taskName` / `planStartDate` / `planEndDate` / `responsible` / `predecessor`
3. 按**责任人**聚合变更；每个责任人合并为一条飞书消息
4. 调用 `notifyPublishChanges(versionNo, changes, MOCK_USER_MAP)`
5. 保存当前 `tasks` 深拷贝到 `publishedSnapshots[currentVersion]`

**不触发通知的字段变化**：`status` / `progress` / `actualStartDate` / `actualEndDate` / `actualDays` / `estimatedDays` — 这些属于执行态，不属于计划变更。

**删除的任务**不通知（用户请求里没提到；责任人收到"你的任务被删除了"可能更混乱）。

### 2.2 场景 B — 到期/逾期提醒

触发：用户进入项目空间并切到某项目的一级计划 Tab 时，`useEffect` 在 `selectedProject.id + projectPlanLevel === 'level1'` 变化时跑一次。

扫描对象：**最新已发布版本**的任务（优先用 `publishedSnapshots[latestPubVersionId]`，mock 初始无快照时 fallback 到当前 `tasks`）。

扫描规则（对每条**叶子任务**）：

- 跳过条件：无 `parentId`（阶段节点）、有 `actualEndDate`（已完成）、`planEndDate` 为空或非法日期
- `daysUntilDue = startOf('day')(planEndDate).diff(today, 'day')`
  - `daysUntilDue < 0` → `overdue`，`daysUntilDue` 为负数表示逾期天数
  - `0 ≤ daysUntilDue ≤ 2` → `due_soon`
  - `daysUntilDue > 2` → 不通知

按责任人聚合；每个责任人合并为一条消息。调用 `notifyDueTasks(notices, MOCK_USER_MAP)`。

**Session-level 去重**：用 `lastDueCheckedProjectRef: useRef<string | null>` 缓存已检查过的 projectId；同一项目在 session 内只跑一次，切换到别的 project 再切回来不会重复弹。

**生产环境说明**（写入代码注释 + PRD）：

> 前端 `useEffect` 的扫描只是 mock 演示。生产环境应由后端每日定时任务（例如凌晨 0 点）对所有项目的一级计划最新已发布版本执行相同检测，调用同样的聚合 + 发送逻辑。前端只负责"进入页面时即时展示一次"。

### 2.3 聚合规则

同一责任人的多条变更（跨 `created` + `modified`）合并为一条飞书消息，消息正文格式：

```
您好 {name}，一级计划 {versionNo} 已发布，您负责的任务变更如下：

【新增 N 条】
  • {id} {taskName}（{planStartDate} ~ {planEndDate}）
  ...

【修改 M 条】
  • {id} {taskName}
    - 任务名称: {old} → {new}
    - 计划完成: {old} → {new}
  ...
```

到期提醒格式类似，按 `overdue` / `due_soon` 分组。

### 2.4 UI 反馈

Stub 调用后：

- `notification.info`（发布变更）或 `notification.warning`（到期提醒）在**右上角**弹出汇总提示
- 发布变更：`已通过飞书通知责任人 · 一级计划 V3 发布，共 5 条变更，已通知 3 位责任人（详情见浏览器控制台）`
- 到期提醒：`任务到期提醒已推送 · 项目 X6877 发现 2 条到期/逾期任务，已通知 1 位责任人`
- 所有详细消息（收件人、主题、正文）在 `console.log` 输出

## 3. 数据模型

### 3.1 新增类型（`src/types/plan-notify.ts`）

```ts
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
  daysUntilDue: number  // negative means overdue
}
```

### 3.2 新增 state（`src/app/page.tsx`）

```ts
const [publishedSnapshots, setPublishedSnapshots] = useState<Record<string, any[]>>({})
const lastDueCheckedProjectRef = useRef<string | null>(null)
```

### 3.3 新增常量（`src/app/page.tsx` 模块级）

```ts
const NOTIFY_DIFF_FIELDS = ['taskName', 'planStartDate', 'planEndDate', 'responsible', 'predecessor'] as const

// Mock 责任人 → 飞书用户映射
// TODO[feishu]: 生产环境从组织通讯录查询真实 open_id / email
const MOCK_USER_MAP: Record<string, { openId: string; email: string; name: string }> = {
  '张三': { openId: 'ou_mock_zhangsan', email: 'zhangsan@transsion.com', name: '张三' },
  '李四': { openId: 'ou_mock_lisi',     email: 'lisi@transsion.com',     name: '李四' },
  '王五': { openId: 'ou_mock_wangwu',   email: 'wangwu@transsion.com',   name: '王五' },
  '赵六': { openId: 'ou_mock_zhaoliu',  email: 'zhaoliu@transsion.com',  name: '赵六' },
  '孙七': { openId: 'ou_mock_sunqi',    email: 'sunqi@transsion.com',    name: '孙七' },
  '周八': { openId: 'ou_mock_zhouba',   email: 'zhouba@transsion.com',   name: '周八' },
  '吴九': { openId: 'ou_mock_wujiu',    email: 'wujiu@transsion.com',    name: '吴九' },
}
```

## 4. Stub 模块（`src/lib/feishu-notify.ts`）

完整文件（生产环境集成说明写在文件头注释）：

```ts
// src/lib/feishu-notify.ts
//
// 飞书通知 stub 模块
//
// 生产环境集成步骤：
//   1. 将本文件中的 sendFeishuMessage() 的实现从 console.log 替换为真实 IM 调用
//      推荐通过后端代理（前端不持有 app_secret）：
//        POST /api/feishu/send-message
//          body: { open_id, subject, body }
//      后端使用 tenant_access_token 调用
//        https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id
//   2. 替换 MOCK_USER_MAP 为真实通讯录查询（调用方传入 userMap 参数）
//   3. 到期提醒的 notifyDueTasks 在生产环境应由后端每日定时任务触发，
//      前端只在用户进入项目空间 L1 页面时调用一次（mock 展示）
//
// 参考文档：
//   https://open.feishu.cn/document/server-docs/im-v1/message/create

import type { TaskChange, PlanDueNotice } from '@/types/plan-notify'

export interface FeishuRecipient {
  openId: string
  email: string
  name: string
}

export async function sendFeishuMessage(
  recipient: FeishuRecipient,
  subject: string,
  body: string
): Promise<void> {
  // TODO[feishu]: 替换下面的 console.log 为真实 IM 调用
  console.log(
    `[Feishu stub] → ${recipient.name} (${recipient.openId})\n  主题: ${subject}\n  正文:\n${body.split('\n').map(l => '    ' + l).join('\n')}`
  )
}

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

## 5. `page.tsx` 改造

### 5.1 `handlePublish()` 扩展

```ts
const handlePublish = () => {
  // 1. Baseline = 上一个已发布版本的任务快照
  const prevPublished = versions
    .filter(v => v.status === '已发布' && v.id !== currentVersion)
    .sort((a, b) => parseInt(b.versionNo.replace('V', '')) - parseInt(a.versionNo.replace('V', '')))[0]
  const baselineTasks: any[] = prevPublished ? (publishedSnapshots[prevPublished.id] || []) : []

  // 2. 计算变更
  const changes = diffTasksForNotify(baselineTasks, tasks)

  // 3. 改 status
  const publishedVersionId = currentVersion
  const publishedVersion = versions.find(v => v.id === publishedVersionId)
  setVersions(versions.map(v =>
    v.id === publishedVersionId ? { ...v, status: '已发布' } : v
  ))

  // 4. 保存本次快照
  setPublishedSnapshots(prev => ({
    ...prev,
    [publishedVersionId]: JSON.parse(JSON.stringify(tasks)),
  }))

  // 5. 通知
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

### 5.2 `diffTasksForNotify` helper

```ts
const diffTasksForNotify = (baseline: any[], current: any[]): TaskChange[] => {
  const baselineMap = new Map(baseline.map(t => [t.id, t]))
  const changes: TaskChange[] = []
  for (const curr of current) {
    const prev = baselineMap.get(curr.id)
    if (!prev) {
      changes.push({ kind: 'created', task: curr })
      continue
    }
    const changedFields: string[] = []
    for (const f of NOTIFY_DIFF_FIELDS) {
      if ((prev[f] ?? '') !== (curr[f] ?? '')) changedFields.push(f)
    }
    if (changedFields.length > 0) {
      changes.push({ kind: 'modified', task: curr, previous: prev, changedFields })
    }
  }
  return changes
}
```

### 5.3 `scanDueTasks` helper

```ts
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

### 5.4 Due-check useEffect

```ts
useEffect(() => {
  if (activeModule !== 'projectSpace') return
  if (!selectedProject) return
  if (projectPlanLevel !== 'level1') return

  const key = selectedProject.id
  if (lastDueCheckedProjectRef.current === key) return
  lastDueCheckedProjectRef.current = key

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

## 6. PRD 更新

**目标章节**: 3.3 一级计划管理

**新增**: 3.3.2 飞书通知机制（插入到 3.3.1 之后、原 3.3.2 之前）

**原小节号顺延**:
- 原 3.3.2 编辑模式详细操作 → 3.3.3
- 原 3.3.3 版本对比功能 → 3.3.4
- 原 3.3.4 竖版表格视图 → 3.3.5
- 原 3.3.5 横版表格视图 → 3.3.6
- 原 3.3.6 甘特图视图 → 3.3.7

**新 3.3.2 内容**：

- 触发场景 A：发布修订版时的变更通知（描述规则、字段集合、聚合逻辑）
- 触发场景 B：任务到期/逾期提醒（描述规则、扫描对象、时机说明）
- 消息内容示例（两个 callout 块展示发布变更 / 到期提醒的文本格式）
- **飞书集成占位 callout**：说明当前代码中的通知发送是 stub 状态，生产环境需要替换 `src/lib/feishu-notify.ts` 的 `sendFeishuMessage` 函数；指明后端代理 `/api/feishu/send-message` 的推荐架构
- **截图占位 callout** × 2：
  - 占位 1: `[截图占位] 发布修订版后的 notification.info 弹出效果 + 控制台 stub 输出`
  - 占位 2: `[截图占位] 进入项目空间 L1 时的到期提醒 notification.warning 效果`
- 实现位置引用：`src/lib/feishu-notify.ts`、`src/types/plan-notify.ts`、`src/app/page.tsx:handlePublish` 和 due-check useEffect

**实现完成后**另起一次"截图补充"流程：用 puppeteer 捕获 notification 弹出的样子，替换两个占位 callout。

## 7. 改动清单

| 文件 | 改动 | 行数 |
|---|---|---|
| 新建 `src/types/plan-notify.ts` | 3 个 interface | ~30 |
| 新建 `src/lib/feishu-notify.ts` | 4 个函数 + 文件头注释 | ~180 |
| `src/app/page.tsx` | import `notification` + stub 函数 + types | +5 |
| `src/app/page.tsx` | 顶层 `NOTIFY_DIFF_FIELDS` / `MOCK_USER_MAP` 常量 | +18 |
| `src/app/page.tsx` | `publishedSnapshots` state + `lastDueCheckedProjectRef` ref | +3 |
| `src/app/page.tsx` | `diffTasksForNotify` helper | +20 |
| `src/app/page.tsx` | `scanDueTasks` helper | +20 |
| `src/app/page.tsx` | `handlePublish` 扩展 | +25（替换现有 ~10 行） |
| `src/app/page.tsx` | due-check useEffect | +30 |
| PRD 远端 | 3.3.2 新章节 + 后续小节号顺延 | 远端更新 |

**总计**：2 个新文件 + 1 个文件修改约 120 行新增 / 10 行替换。

## 8. 边界情况

1. **无责任人的任务**：`responsible` 为空字符串或 undefined，跳过（不计入聚合）
2. **`MOCK_USER_MAP` 未覆盖的责任人**：stub 打 warn 但不抛错，业务主流程不中断
3. **初次发布**（`baseline` 为空）：所有任务都当作 `created` 上报——符合"第一次创建"语义
4. **无已发布版本的 due-check**：`scanTarget` fallback 使用当前 `tasks`（mock 启动态），保证演示可用
5. **同一 session 反复切换项目**：`lastDueCheckedProjectRef` 按 projectId 缓存，同一项目不重复弹；跨项目会重弹（符合"每次进入"语义）
6. **切 L2 再切回 L1**：同一 projectId 已缓存，不会重弹——避免噪音；如需每次 L1 切入都重弹可改为缓存 `projectId::L1`（暂不改）
7. **Stub 异常安全**：stub 内部不 throw，异常只打 console，保证业务主流程无副作用
8. **删除的任务不通知**：diff 里不处理"baseline 有但 current 没有"的 id——符合 YAGNI
9. **父任务字段变化**：父任务也会被 diff 检测到，按责任人通知——符合预期（父任务也有 responsible 字段）
10. **`dayjs` 解析失败的 planEndDate**：`isValid()` 过滤掉

## 9. 测试 / 验证点

手动验证（项目无测试框架）：

- [ ] 进入项目空间 → 某项目 → 一级计划 → 自动触发到期扫描；控制台看到 `[Feishu stub]` 输出；右上角 `notification.warning` 弹出"到期提醒已推送"
- [ ] 该项目当 session 再切 Tab 回 L1，不重复弹（缓存生效）
- [ ] 切到另一个项目 → 重新触发扫描
- [ ] 创建修订版 → 修改一个任务的 `taskName`/`planEndDate`/`responsible` → 发布 → 控制台看到 `[Feishu stub]` 输出；右上角 `notification.info` 弹出"已通知 N 位责任人"
- [ ] 同一修订版里同一责任人的多条变更在控制台应看到合并为一条消息
- [ ] 只修改 `status`/`progress` 等非关键字段 → 发布 → 不触发通知
- [ ] 配置中心模板编辑不触发任何通知（不在作用域内）
- [ ] L2 计划的发布不触发任何通知
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

## 10. YAGNI — 明确不做

- ❌ 真实飞书 IM API 调用（stub only）
- ❌ 后端定时扫描（每日 cron）
- ❌ 通知历史 / 中心 UI / 铃铛
- ❌ 用户免打扰偏好
- ❌ 删除任务的通知
- ❌ L2 计划的通知
- ❌ 配置中心模板变更通知
- ❌ 整机项目按市场分维度通知
- ❌ 已读回执 / 交互式通知卡片
- ❌ 多语言（stub 固定中文）
