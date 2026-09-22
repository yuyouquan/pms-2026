'use client'

import { Fragment } from 'react'
import { Tooltip } from 'antd'
import type { PipelineState, PipelineNodeStatus } from '@/mock/transfer-maintenance'
import { getTransferPipelineRoleDots } from '@/components/transfer/transferPipelineState'

const NODES = [
  { key: 'projectInit', label: '项目发起' },
  { key: 'dataEntry', label: '资料录入与AI检查' },
  { key: 'maintenanceReview', label: '维护审核' },
  { key: 'maintenanceSpmReview', label: '维护SPM审核' },
  { key: 'infoChange', label: '信息变更' },
] as const
const NODE_STATUS: Record<PipelineNodeStatus, { color: string; label: string }> = {
  not_started: { color: '#d1d5db', label: '未开始' },
  in_progress: { color: 'var(--pms-brand)', label: '进行中' },
  success: { color: '#52c41a', label: '已完成' },
  failed: { color: '#ff4d4f', label: '已失败' },
}

export function TransferPipelineProgress({ pipeline }: { pipeline: PipelineState }) {
  return (
    <div className="pms-transfer-pipeline">
      {NODES.map((node, index) => {
        const state = NODE_STATUS[pipeline[node.key]]
        const side = node.key === 'dataEntry' ? 'entry' : node.key === 'maintenanceReview' ? 'review' : null
        const roles = side ? getTransferPipelineRoleDots(pipeline.roleProgress, side) : []
        return (
          <Fragment key={node.key}>
            <div className="pms-transfer-pipeline__node">
              <Tooltip title={`${node.label}：${state.label}`}><div role="img" aria-label={`${node.label}：${state.label}`} style={{ width: 32, height: 32, borderRadius: '50%', background: state.color }} /></Tooltip>
              <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'nowrap' }}>{node.label}</div>
              {side && roles.length > 0 && (
                <div role="group" aria-label={`${node.label}各角色状态`} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 6, maxWidth: 140 }}>
                  {roles.map(dot => (
                    <Tooltip key={dot.role} title={<span style={{ overflowWrap: 'anywhere' }}>{dot.label}</span>} trigger={['hover', 'focus']}>
                      <span
                        role="img"
                        tabIndex={0}
                        aria-label={dot.label}
                        data-transfer-role-dot={dot.role}
                        data-transfer-node={node.key}
                        style={{ display: 'inline-block', flex: '0 0 10px', width: 10, height: 10, boxSizing: 'border-box', borderRadius: '50%', background: dot.color, border: '1px solid rgba(0,0,0,0.1)', outlineOffset: 3, cursor: 'help' }}
                      />
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
            {index < NODES.length - 1 && <div aria-hidden="true" className="pms-transfer-pipeline__connector" />}
          </Fragment>
        )
      })}
    </div>
  )
}
