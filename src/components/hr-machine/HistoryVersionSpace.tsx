'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Tag,
  App,
  Popconfirm,
  Tooltip,
  InputNumber,
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { isLatestHrVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { useHrMachineStore } from '@/stores/hrMachine'
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  BUDGET_TYPE_COLORS,
  BUDGET_TYPE_ROW_CLASS,
  formatPersonMonth,
  MILESTONE_FIELDS,
  MACHINE_BRANDS,
  MACHINE_PRODUCT_LINES,
} from '@/constants/hrMachine'
import type {
  HrMachineVersion,
  HrMachineProject,
  BudgetType,
  MachineBrand,
  MachineProductLine,
  MilestoneNodes,
} from '@/types/hrMachine'
import { exportMultiSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import { useHrConfigStore } from '@/stores/hrConfig'
import { getConfigProjectLevels, getConfigModelVersions } from '@/constants/hrConfig'

/** 扁平化版本行：版本数据 + 所属项目信息 */
interface FlatVersionRow extends HrMachineVersion {
  projectName: string
  isLatest: boolean
  isBound: boolean
  sourceHint: string
  brand: MachineBrand
  productLine: MachineProductLine
  projectStatus: HrMachineProject['status']
}

/** 配置中心人力模型阶段字段 */
const PHASE_FIELDS = [
  { key: 'conceptPhase', label: '概念阶段' },
  { key: 'planningPhase', label: '计划阶段' },
  { key: 'developmentPhase', label: '开发阶段' },
  { key: 'validationPhase', label: '验证阶段' },
  { key: 'launchPhase', label: '上市阶段' },
  { key: 'lifecycle', label: '生命周期' },
] as const

/** Sheet2 行：配置中心人力模型数据 × 等级系数 */
interface Sheet2Row {
  projectName: string
  versionNumber: string
  budgetTypeLabel: string
  primaryDepartment: string
  secondaryDepartment: string
  conceptPhase: number
  planningPhase: number
  developmentPhase: number
  validationPhase: number
  launchPhase: number
  lifecycle: number
  total: number
}

// ── 行内编辑：数字单元格 ──────────────────────────────────────────
function EditableNumberCell({
  value,
  editable,
  onSave,
  formatter = formatPersonMonth,
}: {
  value: number | undefined
  editable: boolean
  onSave: (v: number) => void
  formatter?: (v: number) => string
}) {
  const safeValue = value ?? 0
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(safeValue)

  if (!editable) {
    return <span style={{ fontWeight: 600 }}>{formatter(safeValue)}</span>
  }

  if (editing) {
    return (
      <InputNumber
        size="small"
        value={localValue}
        min={0}
        step={0.01}
        precision={2}
        autoFocus
        style={{ width: '100%' }}
        onChange={(v) => setLocalValue(v ?? 0)}
        onPressEnter={() => {
          onSave(localValue)
          setEditing(false)
        }}
        onBlur={() => {
          onSave(localValue)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <span
      className="pms-inline-editable"
      onClick={() => {
        setLocalValue(safeValue)
        setEditing(true)
      }}
      style={{ fontWeight: 600 }}
    >
      {formatter(safeValue)}
    </span>
  )
}

// ── 行内编辑：日期单元格 ──────────────────────────────────────────
function EditableDateCell({
  value,
  editable,
  onSave,
}: {
  value: string | null
  editable: boolean
  onSave: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)

  if (!editable) {
    return value ? (
      <span style={{ color: 'var(--pms-text-primary)' }}>{value}</span>
    ) : (
      <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
    )
  }

  if (editing) {
    return (
      <DatePicker
        size="small"
        format="YYYY-MM-DD"
        value={value ? dayjs(value) : null}
        open
        onChange={(date) => {
          onSave(date ? date.format('YYYY-MM-DD') : null)
          setEditing(false)
        }}
        onOpenChange={(open) => {
          if (!open) setEditing(false)
        }}
        style={{ width: '100%' }}
      />
    )
  }

  return (
    <span
      className="pms-inline-editable"
      onClick={() => setEditing(true)}
    >
      {value ? (
        <span style={{ color: 'var(--pms-text-primary)' }}>{value}</span>
      ) : (
        <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
      )}
    </span>
  )
}

// ── 行内编辑：下拉选择单元格 ──────────────────────────────────────
function EditableSelectCell({
  value,
  editable,
  options,
  onSave,
  renderDisplay,
}: {
  value: string
  editable: boolean
  options: { label: string; value: string }[]
  onSave: (v: string) => void
  renderDisplay?: (value: string) => ReactNode
}) {
  const [editing, setEditing] = useState(false)

  if (!editable) {
    if (renderDisplay) return <>{renderDisplay(value)}</>
    return <span style={{ color: 'var(--pms-text-primary)' }}>{value || '-'}</span>
  }

  if (editing) {
    return (
      <Select
        size="small"
        value={value || undefined}
        open
        autoFocus
        style={{ width: '100%' }}
        options={options}
        onChange={(v) => {
          onSave(v)
          setEditing(false)
        }}
        onOpenChange={(visible) => {
          if (!visible) setEditing(false)
        }}
        onBlur={() => setEditing(false)}
      />
    )
  }

  return (
    <span
      className="pms-inline-editable"
      onClick={() => setEditing(true)}
    >
      {renderDisplay
        ? renderDisplay(value)
        : value || <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>}
    </span>
  )
}

export default function HistoryVersionSpace() {
  const { message } = App.useApp()
  // ── Store ──────────────────────────────────────────────────────────
  const projects = useHrMachineStore((s) => s.projects)
  const historyVersionFilters = useHrMachineStore((s) => s.historyVersionFilters)
  const setHistoryVersionFilters = useHrMachineStore((s) => s.setHistoryVersionFilters)
  const deleteVersion = useHrMachineStore((s) => s.deleteVersion)
  const deleteProject = useHrMachineStore((s) => s.deleteProject)
  const updateVersion = useHrMachineStore((s) => s.updateVersion)
  const setShowNewVersionModal = useHrMachineStore((s) => s.setShowNewVersionModal)
  const setShowVersionDetailModal = useHrMachineStore((s) => s.setShowVersionDetailModal)
  const setEditingVersionId = useHrMachineStore((s) => s.setEditingVersionId)

  // ── 配置中心 ──────────────────────────────────────────────────────
  const hrModelRecords = useHrConfigStore((s) => s.data.hrModel ?? [])
  const projectLevelOptions = useMemo(
    () => getConfigProjectLevels(hrModelRecords).map((v) => ({ label: v, value: v })),
    [hrModelRecords],
  )
  const modelVersionOptions = useMemo(
    () => getConfigModelVersions(hrModelRecords).map((v) => ({ label: v, value: v })),
    [hrModelRecords],
  )

  // ── 筛选器选项 ────────────────────────────────────────────────────
  const projectNameOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: p.name })),
    [projects],
  )

  // ── 扁平化所有版本 ────────────────────────────────────────────────
  const allFlatVersions = useMemo<FlatVersionRow[]>(() => {
    const rows: FlatVersionRow[] = []
    for (const project of projects) {
      const source = project.ipmProjectCode ? resolveHrFormalSource('machine', project.ipmProjectCode) : null
      for (const version of project.versions) {
        rows.push({
          ...version,
          isLatest: isLatestHrVersion(project, version),
          isBound: !!project.ipmProjectCode,
          sourceHint: version.budgetType !== 'annual' && isLatestHrVersion(project, version) && source
            ? !source.project ? '请重新绑定正式项目' : !source.planVersion ? '等待主市场／主类型一级计划发布' : ''
            : '',
          projectName: project.name,
          brand: project.brand,
          productLine: project.productLine,
          projectStatus: project.status,
        })
      }
    }
    return rows
  }, [projects])

  // ── 应用筛选器 ────────────────────────────────────────────────────
  const filteredVersions = useMemo<FlatVersionRow[]>(() => {
    const f = historyVersionFilters
    const typeOrder = (bt: BudgetType) => BUDGET_TYPES.findIndex((t) => t.value === bt)

    return allFlatVersions
      .filter((row) => {
        if (f.budgetType.length > 0 && !f.budgetType.includes(row.budgetType)) return false
        if (f.projectName.length > 0 && !f.projectName.includes(row.projectName)) return false
        if (f.brand.length > 0 && !f.brand.includes(row.brand)) return false
        if (f.productLine.length > 0 && !f.productLine.includes(row.productLine)) return false
        return true
      })
      .sort((a, b) => {
        // 按项目名称 → 预算类型 → 版本号降序 排序
        const byName = a.projectName.localeCompare(b.projectName, 'zh-CN')
        if (byName !== 0) return byName
        const byType = typeOrder(a.budgetType) - typeOrder(b.budgetType)
        if (byType !== 0) return byType
        if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion
        return b.minorVersion - a.minorVersion
      })
  }, [allFlatVersions, historyVersionFilters])

  // ── 列定义 ────────────────────────────────────────────────────────
  const columns = useMemo<ColumnsType<FlatVersionRow>>(() => {
    const milestoneColumns: ColumnsType<FlatVersionRow> = MILESTONE_FIELDS.map((field) => ({
      title: field.label,
      key: field.key,
      width: 120,
      align: 'center',
      render: (_value: unknown, record: FlatVersionRow) => (
        <EditableDateCell
          value={record.milestones[field.key]}
          editable={record.isLatest && (record.budgetType === 'annual' || !record.isBound)}
          onSave={(v) =>
            updateVersion(record.projectId, record.id, {
              milestones: { [field.key]: v } as Partial<MilestoneNodes>,
            })
          }
        />
      ),
    }))

    return [
      {
        title: '项目名称',
        key: 'projectName',
        width: 170,
        fixed: 'left',
        render: (_value: unknown, record: FlatVersionRow) => (
          <div>
            <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>{record.projectName}</span>
            {record.sourceHint && <div style={{ color: 'var(--pms-text-secondary)', fontSize: 12 }}>{record.sourceHint}</div>}
          </div>
        ),
      },
      {
        title: '预算类型',
        key: 'budgetType',
        width: 100,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <Tag color={BUDGET_TYPE_COLORS[record.budgetType]}>{BUDGET_TYPE_LABELS[record.budgetType]}</Tag>
        ),
      },
      {
        title: '版本号',
        key: 'versionNumber',
        width: 90,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <span style={{ fontWeight: 600, color: 'var(--pms-brand-strong)' }}>
            {record.versionNumber}
          </span>
        ),
      },
      { title: '品牌', key: 'brand', width: 90, render: (_v, r) => r.brand },
      { title: '产品线', key: 'productLine', width: 90, render: (_v, r) => r.productLine },
      {
        title: '项目等级',
        key: 'projectLevel',
        width: 90,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <EditableSelectCell
            value={record.projectLevel}
            editable={record.isLatest && (record.budgetType === 'annual' || !record.isBound)}
            options={projectLevelOptions}
            onSave={(v) => updateVersion(record.projectId, record.id, { projectLevel: v })}
            renderDisplay={(v) =>
              v ? (
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: 28,
                    padding: '2px 10px',
                    borderRadius: 10,
                    background: 'var(--pms-brand-surface)',
                    color: 'var(--pms-brand-strong)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid var(--pms-brand-border)',
                  }}
                >
                  {v}
                </span>
              ) : (
                <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
              )
            }
          />
        ),
      },
      {
        title: '等级系数',
        key: 'levelCoefficient',
        width: 90,
        align: 'right',
        render: (_value: unknown, record: FlatVersionRow) => (
          <EditableNumberCell
            value={record.levelCoefficient}
            editable={record.isLatest}
            formatter={(v) => (v ?? 0).toFixed(2)}
            onSave={(v) => updateVersion(record.projectId, record.id, { levelCoefficient: v })}
          />
        ),
      },
      {
        title: '人力模型版本',
        key: 'hrModelVersion',
        width: 120,
        render: (_value: unknown, record: FlatVersionRow) => (
          <EditableSelectCell
            value={record.hrModelVersion}
            editable={record.isLatest}
            options={modelVersionOptions}
            onSave={(v) => updateVersion(record.projectId, record.id, { hrModelVersion: v })}
          />
        ),
      },
      {
        title: '预估投入',
        key: 'estimatedInvestment',
        width: 110,
        align: 'right',
        render: (_value: unknown, record: FlatVersionRow) => (
          <span style={{ fontWeight: 600 }}>{formatPersonMonth(record.estimatedInvestment)}</span>
        ),
      },
      ...milestoneColumns,
      {
        title: '创建人',
        key: 'createdBy',
        width: 90,
        align: 'center',
        render: (_v, r) => r.createdBy || '-',
      },
      {
        title: '创建日期',
        key: 'createdAt',
        width: 180,
        align: 'center',
        render: (_v, r) => r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 190,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => {
          const project = projects.find((p) => p.id === record.projectId)
          return (
            <Space size={4}>
              <Button
                type="default"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingVersionId(record.id)
                  setShowVersionDetailModal(true)
                }}
              >
                查看
              </Button>
              <Popconfirm
                title="删除版本数据"
                description="删除后不可恢复；若所有版本均被删除，该项目将一并删除。"
                okText="确认删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => {
                  if (!project) return
                  const remaining = project.versions.filter((v) => v.id !== record.id)
                  deleteVersion(record.projectId, record.id)
                  if (remaining.length === 0) {
                    deleteProject(record.projectId)
                    message.success('所有版本已删除，项目已一并删除')
                  } else {
                    message.success('版本已删除')
                  }
                }}
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )
        },
      },
    ]
  }, [projects, deleteVersion, deleteProject, updateVersion, projectLevelOptions, modelVersionOptions, setShowVersionDetailModal, setEditingVersionId])

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = () => {
    // Sheet1: 项目预估投入列表
    const sheet1Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称', formatter: (_v, row: FlatVersionRow) => row.projectName },
      {
        key: 'budgetType',
        title: '预算类型',
        formatter: (_v, row: FlatVersionRow) => BUDGET_TYPE_LABELS[row.budgetType],
      },
      {
        key: 'versionNumber',
        title: '版本号',
        formatter: (_v, row: FlatVersionRow) => row.versionNumber,
      },
      { key: 'brand', title: '品牌', formatter: (_v, row: FlatVersionRow) => row.brand },
      { key: 'productLine', title: '产品线', formatter: (_v, row: FlatVersionRow) => row.productLine },
      { key: 'projectLevel', title: '项目等级', formatter: (_v, row: FlatVersionRow) => row.projectLevel },
      { key: 'levelCoefficient', title: '等级系数', formatter: (_v, row: FlatVersionRow) => row.levelCoefficient },
      { key: 'hrModelVersion', title: '人力模型版本', formatter: (_v, row: FlatVersionRow) => row.hrModelVersion },
      {
        key: 'estimatedInvestment',
        title: '预估投入(人月)',
        formatter: (_v, row: FlatVersionRow) => row.estimatedInvestment,
      },
      ...MILESTONE_FIELDS.map((f) => ({
        key: f.key,
        title: f.label,
        formatter: (_v: unknown, row: FlatVersionRow) => row.milestones[f.key] ?? '',
      })),
      {
        key: 'createdBy',
        title: '创建人',
        formatter: (_v, row: FlatVersionRow) => row.createdBy ?? '',
      },
      {
        key: 'createdAt',
        title: '创建日期',
        formatter: (_v, row: FlatVersionRow) => row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') : '',
      },
    ]

    // Sheet2: 配置中心人力模型数据 × 等级系数
    const sheet2Rows: Sheet2Row[] = []
    for (const version of filteredVersions) {
      const configRecords = hrModelRecords.filter(
        (r) =>
          r.enabled !== false &&
          String(r.projectLevel) === version.projectLevel &&
          String(r.modelVersion) === version.hrModelVersion,
      )
      for (const record of configRecords) {
        const phases: Record<string, number> = {}
        let total = 0
        for (const field of PHASE_FIELDS) {
          const raw = Number(record[field.key] ?? 0)
          const val = Math.round(raw * version.levelCoefficient * 10) / 10
          phases[field.key] = val
          total += val
        }
        sheet2Rows.push({
          projectName: version.projectName,
          versionNumber: version.versionNumber,
          budgetTypeLabel: BUDGET_TYPE_LABELS[version.budgetType],
          primaryDepartment: String(record.primaryDepartment ?? ''),
          secondaryDepartment: String(record.secondaryDepartment ?? ''),
          conceptPhase: phases.conceptPhase,
          planningPhase: phases.planningPhase,
          developmentPhase: phases.developmentPhase,
          validationPhase: phases.validationPhase,
          launchPhase: phases.launchPhase,
          lifecycle: phases.lifecycle,
          total: Math.round(total * 10) / 10,
        })
      }
    }

    const sheet2Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称', formatter: (_v, row: Sheet2Row) => row.projectName },
      { key: 'versionNumber', title: '版本号', formatter: (_v, row: Sheet2Row) => row.versionNumber },
      { key: 'budgetTypeLabel', title: '预算类型', formatter: (_v, row: Sheet2Row) => row.budgetTypeLabel },
      { key: 'primaryDepartment', title: '一级部门', formatter: (_v, row: Sheet2Row) => row.primaryDepartment },
      { key: 'secondaryDepartment', title: '二级部门', formatter: (_v, row: Sheet2Row) => row.secondaryDepartment },
      ...PHASE_FIELDS.map((f) => ({
        key: f.key,
        title: f.label,
        formatter: (_v: unknown, row: Sheet2Row) => row[f.key],
      })),
      { key: 'total', title: '预估投入合计', formatter: (_v, row: Sheet2Row) => row.total },
    ]

    exportMultiSheet(
      [
        { rows: filteredVersions, columns: sheet1Columns, sheetName: '项目预估投入列表' },
        { rows: sheet2Rows, columns: sheet2Columns, sheetName: '部门阶段预估投入明细' },
      ],
      `项目预估投入_${exportTimestamp()}.xlsx`,
    )
  }

  return (
    <div className="pms-hr-machine-history-version">
      {/* 筛选器工具条 */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ borderRadius: 8, marginBottom: 12 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Space size={12} wrap style={{ flex: 1, minWidth: 0 }}>
            <Space size={12} className="pms-hr-filter-field">
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                预算类型
              </span>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择预算类型"
                style={{ minWidth: 180 }}
                maxTagCount="responsive"
                value={historyVersionFilters.budgetType}
                onChange={(v) => setHistoryVersionFilters({ budgetType: v as BudgetType[] })}
                options={BUDGET_TYPES}
                optionFilterProp="label"
              />
            </Space>

            <Space size={12} className="pms-hr-filter-field">
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                项目名称
              </span>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择项目名称"
                style={{ minWidth: 200 }}
                maxTagCount="responsive"
                value={historyVersionFilters.projectName}
                onChange={(v) => setHistoryVersionFilters({ projectName: v as string[] })}
                options={projectNameOptions}
                optionFilterProp="label"
              />
            </Space>

            <Space size={12} className="pms-hr-filter-field">
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                品牌
              </span>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择品牌"
                style={{ minWidth: 150 }}
                maxTagCount="responsive"
                value={historyVersionFilters.brand}
                onChange={(v) => setHistoryVersionFilters({ brand: v as MachineBrand[] })}
                options={MACHINE_BRANDS}
                optionFilterProp="label"
              />
            </Space>

            <Space size={12} className="pms-hr-filter-field">
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                产品线
              </span>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择产品线"
                style={{ minWidth: 150 }}
                maxTagCount="responsive"
                value={historyVersionFilters.productLine}
                onChange={(v) => setHistoryVersionFilters({ productLine: v as MachineProductLine[] })}
                options={MACHINE_PRODUCT_LINES}
                optionFilterProp="label"
              />
            </Space>
          </Space>

          <Space size={8} style={{ flexShrink: 0 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowNewVersionModal(true)}
            >
              新增版本
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </div>
      </Card>

      {/* 版本列表 */}
      <Table<FlatVersionRow>
        className="pms-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredVersions}
        tableLayout="fixed"
        scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
        pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条版本' }}
        rowClassName={(record) => {
          const budgetClass = BUDGET_TYPE_ROW_CLASS[record.budgetType] ?? ''
          return budgetClass
        }}
        locale={{ emptyText: '当前筛选条件下暂无版本数据' }}
      />

      <style jsx global>{`
        .pms-hr-machine-history-version .pms-table .ant-table-tbody > tr.hr-machine-budget-annual > td {
          background: #f9f6fd !important;
        }
        .pms-hr-machine-history-version .pms-table .ant-table-tbody > tr.hr-machine-budget-estimate > td {
          background: #fff9f2 !important;
        }
        .pms-hr-machine-history-version .pms-table .ant-table-tbody > tr.hr-machine-budget-budget > td {
          background: #f4fcf7 !important;
        }
        .pms-hr-machine-history-version .pms-inline-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
          display: inline-block;
          min-width: 24px;
          text-align: center;
        }
        .pms-hr-machine-history-version .pms-inline-editable:hover {
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }
        .pms-hr-machine-history-version .pms-table .ant-inputnumber {
          width: 100%;
        }
        .pms-hr-machine-history-version .pms-table .ant-picker {
          width: 100%;
        }
        .pms-hr-machine-history-version .pms-table .ant-select {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
