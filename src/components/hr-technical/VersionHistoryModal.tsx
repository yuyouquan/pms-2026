'use client'

import { useMemo } from 'react'
import { Modal, Tag, Timeline, Empty } from 'antd'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import {
  TECH_BUDGET_TYPE_LABELS,
  TECH_BUDGET_TYPE_COLORS,
} from '@/constants/hrTechnical'
import type { TechVersionOperationType } from '@/types/hrTechnical'

interface VersionHistoryModalProps {
  open: boolean
  versionId: string | null
  onCancel: () => void
}

const OPERATION_LABELS: Record<TechVersionOperationType, { label: string; color: string }> = {
  created: { label: '创建', color: 'blue' },
  locked: { label: '锁定', color: 'red' },
  unlocked: { label: '解锁', color: 'orange' },
  copied: { label: '复制', color: 'purple' },
  deleted: { label: '删除', color: 'magenta' },
  edited: { label: '编辑', color: 'gold' },
  deptUpdated: { label: '部门投入更新', color: 'cyan' },
}

export default function VersionHistoryModal({ open, versionId, onCancel }: VersionHistoryModalProps) {
  const { projects } = useHrTechnicalStore()

  const version = useMemo(() => {
    if (!versionId) return null
    for (const p of projects) {
      const v = p.versions.find(v => v.id === versionId)
      if (v) return { version: v, project: p }
    }
    return null
  }, [versionId, projects])

  const logs = version?.version.operationLogs ?? []

  return (
    <Modal
      className="pms-modal"
      title="版本操作历史"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
    >
      {version ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16, display: 'flex', gap: 24, fontSize: 12, color: 'var(--pms-text-secondary)', flexWrap: 'wrap' }}>
            <span>TDT项目：<strong style={{ color: 'var(--pms-text-primary)' }}>{version.project.tdtName}</strong></span>
            <span>预算类型：
              <Tag color={TECH_BUDGET_TYPE_COLORS[version.version.budgetType]} style={{ marginLeft: 4 }}>
                {TECH_BUDGET_TYPE_LABELS[version.version.budgetType]}
              </Tag>
            </span>
            <span>版本号：<strong style={{ color: 'var(--pms-text-primary)' }}>{version.version.versionNumber}</strong></span>
          </div>

          {logs.length > 0 ? (
            <Timeline
              items={logs.map(log => {
                const opInfo = OPERATION_LABELS[log.operation] ?? { label: log.operation, color: 'default' }
                return {
                  color: opInfo.color as any,
                  children: (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color={opInfo.color}>{opInfo.label}</Tag>
                        <span style={{ color: 'var(--pms-text-primary)', fontWeight: 500 }}>{log.operator}</span>
                        <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12 }}>{log.timestamp}</span>
                      </div>
                      <div style={{ color: 'var(--pms-text-secondary)', fontSize: 12 }}>{log.description}</div>
                    </div>
                  ),
                }
              })}
            />
          ) : (
            <Empty description="暂无操作记录" />
          )}
        </div>
      ) : (
        <Empty description="版本不存在" />
      )}
    </Modal>
  )
}
