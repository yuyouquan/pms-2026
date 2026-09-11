'use client'

import { HrVersionMilestoneDetails } from '@/components/project-resources/HrVersionMilestones'

import { useMemo } from 'react'
import { Modal, Table, Tag, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import { useHrConfigStore } from '@/stores/hrConfig'
import { calcMachineDepartmentInvestments } from '@/constants/hrConfig'
import {
  BUDGET_TYPE_LABELS,
  BUDGET_TYPE_COLORS,
  formatPersonMonth,
} from '@/constants/hrMachine'

/** 配置中心阶段字段定义（与 hrConfig 中 HR_MODEL_PHASE_KEYS 一致） */
const PHASE_FIELDS = [
  { key: 'conceptPhase', label: '概念阶段' },
  { key: 'planningPhase', label: '计划阶段' },
  { key: 'developmentPhase', label: '开发阶段' },
  { key: 'validationPhase', label: '验证阶段' },
  { key: 'launchPhase', label: '上市阶段' },
  { key: 'lifecycle', label: '生命周期' },
] as const

/** 行数据：部门 + 各阶段系数后值 */
interface DeptPhaseRow {
  id: string
  primaryDepartment: string
  secondaryDepartment: string
  phases: Record<string, number>
  total: number
}

interface MachineVersionDetailModalProps {
  open: boolean
  versionId: string | null
  onCancel: () => void
}

export default function MachineVersionDetailModal({
  open,
  versionId,
  onCancel,
}: MachineVersionDetailModalProps) {
  const projects = useHrMachineStore((s) => s.projects)
  const hrModelRecords = useHrConfigStore((s) => s.data.hrModel ?? [])

  // ── 查找版本与项目 ──────────────────────────────────────────────
  const { version, project } = useMemo(() => {
    if (!versionId) return { version: null, project: null }
    for (const p of projects) {
      const v = p.versions.find((ver) => ver.id === versionId)
      if (v) return { version: v, project: p }
    }
    return { version: null, project: null }
  }, [projects, versionId])

  // ── 从配置中心获取部门阶段数据并乘以等级系数 ────────────────────
  const dataSource = useMemo<DeptPhaseRow[]>(() => {
    if (!version) return []

    return calcMachineDepartmentInvestments(hrModelRecords, version.projectLevel, version.hrModelVersion, version.levelCoefficient)
      .map(department => ({
        id: `${version.id}-${department.id}`,
        primaryDepartment: department.primaryDepartment,
        secondaryDepartment: department.secondaryDepartment,
        phases: department.phases,
        total: department.estimatedTotal,
      }))
  }, [version, hrModelRecords])

  // ── 列定义 ──────────────────────────────────────────────────────
  const columns = useMemo<ColumnsType<DeptPhaseRow>>(() => {
    const phaseCols: ColumnsType<DeptPhaseRow> = PHASE_FIELDS.map((f) => ({
      title: f.label,
      key: f.key,
      width: 100,
      align: 'right',
      render: (_v: unknown, record: DeptPhaseRow) => (
        <span style={{ fontWeight: 500 }}>{formatPersonMonth(record.phases[f.key])}</span>
      ),
    }))

    return [
      {
        title: '一级部门',
        key: 'primaryDepartment',
        width: 120,
        render: (_v: unknown, r: DeptPhaseRow) => (
          <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>
            {r.primaryDepartment}
          </span>
        ),
      },
      {
        title: '二级部门',
        key: 'secondaryDepartment',
        width: 120,
        render: (_v: unknown, r: DeptPhaseRow) => r.secondaryDepartment,
      },
      ...phaseCols,
      {
        title: '预估投入合计',
        key: 'total',
        width: 120,
        align: 'right',
        render: (_v: unknown, r: DeptPhaseRow) => (
          <span style={{ fontWeight: 700, color: 'var(--pms-brand-strong)' }}>
            {formatPersonMonth(r.total)}
          </span>
        ),
      },
    ]
  }, [])

  // ── 合计行 ──────────────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    return Math.round(dataSource.reduce((sum, r) => sum + r.total, 0) * 10) / 10
  }, [dataSource])

  return (
    <Modal
      open={open}
      title="版本预估投入详情"
      width={1280}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
    >
      {version && project ? (
        <>
          <Descriptions
            size="small"
            column={4}
            bordered
            style={{ marginBottom: 16 }}
            items={[
              { key: 'projectName', label: '项目名称', children: project.name },
              { key: 'versionNumber', label: '版本号', children: version.versionNumber },
              {
                key: 'budgetType',
                label: '预算类型',
                children: (
                  <Tag color={BUDGET_TYPE_COLORS[version.budgetType]}>
                    {BUDGET_TYPE_LABELS[version.budgetType]}
                  </Tag>
                ),
              },
              { key: 'projectLevel', label: '项目等级', children: version.projectLevel || '-' },
              { key: 'levelCoefficient', label: '等级系数', children: (version.levelCoefficient ?? 0).toFixed(2) },
              { key: 'hrModelVersion', label: '人力模型版本', children: version.hrModelVersion || '-' },
              {
                key: 'estimatedInvestment',
                label: '预估投入(人月)',
                children: formatPersonMonth(version.estimatedInvestment),
              },
            ]}
          />

        <HrVersionMilestoneDetails category="machine" values={version.milestones} />

          <Table<DeptPhaseRow>
            className="pms-table pms-hr-investment-table"
            rowKey="id"
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
            size="small"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <span style={{ fontWeight: 700, color: 'var(--pms-brand-strong)' }}>合计</span>
                  </Table.Summary.Cell>
                  {PHASE_FIELDS.map((f) => (
                    <Table.Summary.Cell key={f.key} index={2 + PHASE_FIELDS.indexOf(f)} align="right">
                      <span style={{ fontWeight: 600 }}>
                        {formatPersonMonth(
                          Math.round(
                            dataSource.reduce((s, r) => s + r.phases[f.key], 0) * 10,
                          ) / 10,
                        )}
                      </span>
                    </Table.Summary.Cell>
                  ))}
                  <Table.Summary.Cell index={8} align="right">
                    <span style={{ fontWeight: 700, color: 'var(--pms-brand-strong)' }}>
                      {formatPersonMonth(grandTotal)}
                    </span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />

          <div style={{ marginTop: 8, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>
            数据来源：配置中心 → 人力资源管道 → 整机人力模型（项目等级 {version.projectLevel || '-'} / 模型版本 {version.hrModelVersion || '-'}），各阶段值已乘以等级系数 {(version.levelCoefficient ?? 0).toFixed(2)}。
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--pms-text-tertiary)' }}>
          未找到版本数据
        </div>
      )}
    </Modal>
  )
}
