'use client'

import { useMemo } from 'react'
import { Modal, Timeline, Tag, Spin, Empty } from 'antd'
import { useHrTosStore } from '@/hooks/useHrResourceStores'
import { TOS_BUDGET_TYPE_LABELS } from '@/constants/hrTos'
import type { TosVersionOperationLog, TosVersionOperationType } from '@/types/hrTos'

interface VersionHistoryModalProps {
  open: boolean
  versionId: string | null
  projectId: string
  onCancel: () => void
}

/** 操作类型 → 中文标签 */
const OPERATION_LABELS: Record<TosVersionOperationType, string> = {
  created: '创建',
  locked: '锁定',
  unlocked: '解锁',
  copied: '复制',
  deleted: '删除',
  edited: '编辑',
  deptUpdated: '部门投入更新',
}

/** 操作类型 → 颜色（同时用于 Timeline 圆点与 Tag） */
const OPERATION_COLORS: Record<TosVersionOperationType, string> = {
  created: 'green',
  locked: 'red',
  unlocked: 'blue',
  copied: 'purple',
  deleted: 'default',
  edited: 'gold',
  deptUpdated: 'cyan',
}

export default function VersionHistoryModal({
  open,
  versionId,
  projectId,
  onCancel,
}: VersionHistoryModalProps) {
  const projects = useHrTosStore((s) => s.projects)

  // ── 定位版本与所属项目 ──────────────────────────────────────────────
  const { project, version } = useMemo(() => {
    const p = projects.find((pp) => pp.id === projectId)
    if (!p) return { project: null, version: null }
    const v = p.versions.find((vv) => vv.id === versionId)
    if (!v) return { project: null, version: null }
    return { project: p, version: v }
  }, [projects, projectId, versionId])

  // ── 操作日志按时间倒序排列（最新在前） ─────────────────────────────
  const sortedLogs: TosVersionOperationLog[] = useMemo(() => {
    if (!version) return []
    return [...version.operationLogs]
      .map((log, idx) => ({ log, idx }))
      .sort((a, b) => {
        const ta = new Date(a.log.timestamp).getTime()
        const tb = new Date(b.log.timestamp).getTime()
        if (ta !== tb) return tb - ta
        // 时间相同时，原数组中靠后的视为较新
        return b.idx - a.idx
      })
      .map((x) => x.log)
  }, [version])

  // ── 数据未就绪时展示加载态 ──────────────────────────────────────────
  const notReady = !project || !version

  return (
    <Modal
      className="pms-modal"
      title="版本操作记录"
      open={open}
      onCancel={onCancel}
      okButtonProps={{ style: { display: 'none' } }}
      cancelText="关闭"
      width={640}
    >
      {notReady ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* 版本信息头部 */}
          <div
            style={{
              marginBottom: 20,
              display: 'flex',
              gap: 24,
              fontSize: 13,
              color: 'var(--pms-text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <span>
              项目名称：
              <strong style={{ color: 'var(--pms-text-primary)' }}>{project.name}</strong>
            </span>
            <span>
              版本号：
              <strong style={{ color: 'var(--pms-text-primary)' }}>
                {version.versionNumber}
              </strong>
            </span>
            <span>
              预算类型：
              <strong style={{ color: 'var(--pms-text-primary)' }}>
                {TOS_BUDGET_TYPE_LABELS[version.budgetType]}
              </strong>
            </span>
          </div>

          {/* 操作记录时间线 */}
          {sortedLogs.length === 0 ? (
            <Empty
              description="暂无操作记录"
              style={{ padding: '48px 0' }}
            />
          ) : (
            <Timeline
              className="pms-version-history-timeline"
              items={sortedLogs.map((log) => ({
                key: log.id,
                color: OPERATION_COLORS[log.operation],
                children: (
                  <div className="pms-version-history-item">
                    <div className="pms-version-history-item-main">
                      <Tag color={OPERATION_COLORS[log.operation]}>
                        {OPERATION_LABELS[log.operation]}
                      </Tag>
                      <span className="pms-version-history-item-desc">
                        {log.description}
                      </span>
                    </div>
                    <div className="pms-version-history-item-meta">
                      <span className="pms-version-history-item-operator">
                        操作人：{log.operator || '—'}
                      </span>
                      <span className="pms-version-history-item-time">
                        {log.timestamp}
                      </span>
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </div>
      )}

      <style jsx global>{`
        .pms-version-history-timeline .ant-timeline-item-content {
          margin-inline-start: 28px;
        }
        .pms-version-history-timeline .ant-timeline-item:last-child {
          padding-bottom: 0;
        }
        .pms-version-history-item {
          margin-bottom: 4px;
        }
        .pms-version-history-item-main {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pms-version-history-item-desc {
          color: var(--pms-text-primary);
          font-size: 13px;
        }
        .pms-version-history-item-time {
          font-size: 12px;
          color: var(--pms-text-tertiary);
        }
        .pms-version-history-item-meta {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: var(--pms-text-tertiary);
        }
        .pms-version-history-item-operator {
          color: var(--pms-text-secondary);
        }
      `}</style>
    </Modal>
  )
}
