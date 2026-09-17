'use client'

import { HrVersionModalTitle } from '@/components/project-resources/HrVersionModalTitle'

import NonLaborInvestmentSection from '@/components/project-resources/NonLaborInvestmentSection'
import { withHrNonLaborRange } from '@/lib/hrNonLaborRange'

import { HrVersionMilestoneDetails } from '@/components/project-resources/HrVersionMilestones'

import { machinePhaseFields } from '@/lib/hrMachinePeriods'
import { useMemo } from 'react'
import { Alert, Modal, Table, Tag, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/hooks/useHrResourceStores'
import { calcMachineDepartmentInvestments } from '@/constants/hrConfig'
import {
  BUDGET_TYPE_LABELS,
  BUDGET_TYPE_COLORS,
  formatPersonMonth,
} from '@/constants/hrMachine'

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

  // ── 查找版本与项目 ──────────────────────────────────────────────
  const { version, project } = useMemo(() => {
    if (!versionId) return { version: null, project: null }
    for (const p of projects) {
      const v = p.versions.find((ver) => ver.id === versionId)
      if (v) return { version: v, project: p }
    }
    return { version: null, project: null }
  }, [projects, versionId])

  const phaseFields = machinePhaseFields(version?.modelSnapshot ?? [])

  // 历史详情仅使用该版本保存的模型，无法还原的旧明细不以当前配置冒充。
  const dataSource = useMemo<DeptPhaseRow[]>(() => {
    if (!version) return []

    return calcMachineDepartmentInvestments(version.modelSnapshot ?? [], version.projectLevel, version.hrModelVersion, version.levelCoefficient)
      .map(department => ({
        id: `${version.id}-${department.id}`,
        primaryDepartment: department.primaryDepartment,
        secondaryDepartment: department.secondaryDepartment,
        phases: department.phases,
        total: department.estimatedTotal,
      }))
  }, [version])

  // ── 列定义 ──────────────────────────────────────────────────────
  const columns = useMemo<ColumnsType<DeptPhaseRow>>(() => {
    const phaseCols: ColumnsType<DeptPhaseRow> = phaseFields.map((f) => ({
      title: f.label,
      key: f.key,
      width: 145,
      align: 'center',
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
        align: 'center',
        render: (_v: unknown, r: DeptPhaseRow) => (
          <span style={{ fontWeight: 700, color: 'var(--pms-brand-strong)' }}>
            {formatPersonMonth(r.total)}
          </span>
        ),
      },
    ]
  }, [phaseFields])

  // ── 合计行 ──────────────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    return Math.round(dataSource.reduce((sum, r) => sum + r.total, 0) * 10) / 10
  }, [dataSource])

  return (
    <Modal
      className="pms-modal pms-hr-version-modal"
      open={open}
      title={<HrVersionModalTitle title="版本预估投入详情" versionNumber={version?.versionNumber} />}
      width={1280}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
    >
      {version && project ? (
        <>
          <Descriptions
            size="small"
            column={3}
            bordered
            style={{ marginBottom: 12 }}
            items={[
              { key: 'projectName', label: '项目名称', children: project.name },
              {
                key: 'budgetType',
                label: '预算类型',
                children: (
                  <Tag color={BUDGET_TYPE_COLORS[version.budgetType]}>
                    {BUDGET_TYPE_LABELS[version.budgetType]}
                  </Tag>
                ),
              },
              {
                key: 'estimatedInvestment',
                label: '预估投入(人月)',
                children: formatPersonMonth(version.estimatedInvestment),
              },
              { key: 'brand', label: '品牌', children: project.brand || '-' },
              { key: 'productLine', label: '产品线', children: project.productLine || '-' },
              { key: 'marketName', label: '市场名', children: project.marketName || '-' },
              { key: 'projectLevel', label: '项目等级', children: version.projectLevel || '-' },
              { key: 'levelCoefficient', label: '等级系数', children: (version.levelCoefficient ?? 0).toFixed(2) },
              { key: 'hrModelVersion', label: '人力模型版本', children: version.hrModelVersion || '-' },
            ]}
          />

        <HrVersionMilestoneDetails category="machine" values={version.milestones} />

          <h3 className="pms-hr-investment-section-title">各部门人力投入</h3>
          {version.modelSnapshot ? <Table<DeptPhaseRow>
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
                  {phaseFields.map((f, index) => (
                    <Table.Summary.Cell key={f.key} index={2 + index} align="center">
                      <span style={{ fontWeight: 600 }}>
                        {formatPersonMonth(
                          Math.round(
                            dataSource.reduce((s, r) => s + (r.phases[f.key] ?? 0), 0) * 10,
                          ) / 10,
                        )}
                      </span>
                    </Table.Summary.Cell>
                  ))}
                  <Table.Summary.Cell index={2 + phaseFields.length} align="center">
                    <span style={{ fontWeight: 700, color: 'var(--pms-brand-strong)' }}>
                      {formatPersonMonth(grandTotal)}
                    </span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          /> : <Alert type="info" showIcon title="该历史版本未保存模型明细，无法还原原始部门投入；版本总额和里程碑仍保留。" />}

          {version.modelSnapshot && <div style={{ marginTop: 8, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>
            数据来源：版本保存的整机人力模型（项目等级 {version.projectLevel || '-'} / 模型版本 {version.hrModelVersion || '-'}），各阶段值已乘以等级系数 {(version.levelCoefficient ?? 0).toFixed(2)}。
          </div>}
          <NonLaborInvestmentSection value={withHrNonLaborRange(version.nonLaborInvestment, 'machine', version.milestones)} readOnly />
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--pms-text-tertiary)' }}>
          未找到版本数据
        </div>
      )}
    </Modal>
  )
}
