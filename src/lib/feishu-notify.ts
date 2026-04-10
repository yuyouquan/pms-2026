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
