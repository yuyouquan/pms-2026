'use client'

import { useMemo, useState } from 'react'
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
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  CopyOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { isLatestHrVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import {
  TECH_BUDGET_TYPES,
  TECH_BUDGET_TYPE_LABELS,
  TECH_BUDGET_TYPE_COLORS,
  TECH_BUDGET_TYPE_ROW_CLASS,
  formatPersonMonth,
  TECH_MILESTONE_FIELDS,
  TECH_PHASE_INVESTMENT_FIELDS,
} from '@/constants/hrTechnical'
import type {
  HrTechnicalVersion,
  HrTechnicalProject,
  BudgetType,
  TechMilestoneNodes,
  TechDepartmentInvestment,
} from '@/types/hrTechnical'
import { exportMultiSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

/** 扁平化版本行：版本数据 + 所属项目信息 */
interface FlatVersionRow extends HrTechnicalVersion {
  projectName: string
  isLatest: boolean
  isBound: boolean
  sourceHint: string
  projectStatus: HrTechnicalProject['status']
}

/** Sheet2 行类型 */
interface Sheet2Row extends TechDepartmentInvestment {
  projectName: string
  versionNumber: string
  budgetTypeLabel: string
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
        onChange={date => {
          onSave(date ? date.format('YYYY-MM-DD') : null)
          setEditing(false)
        }}
        onOpenChange={open => {
          if (!open) setEditing(false)
        }}
        style={{ width: '100%' }}
      />
    )
  }

  return (
    <span className="pms-inline-editable" onClick={() => setEditing(true)}>
      {value ? (
        <span style={{ color: 'var(--pms-text-primary)' }}>{value}</span>
      ) : (
        <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
      )}
    </span>
  )
}

export default function HistoryVersionSpace() {
  const { message } = App.useApp()
  // ── Store ──────────────────────────────────────────────────────────
  const projects = useHrTechnicalStore(s => s.projects)
  const historyVersionFilters = useHrTechnicalStore(s => s.historyVersionFilters)
  const setHistoryVersionFilters = useHrTechnicalStore(s => s.setHistoryVersionFilters)
  const selectedProjectId = useHrTechnicalStore(s => s.selectedProjectId)
  const setSelectedProjectId = useHrTechnicalStore(s => s.setSelectedProjectId)
  const deleteVersion = useHrTechnicalStore(s => s.deleteVersion)
  const deleteProject = useHrTechnicalStore(s => s.deleteProject)
  const copyVersion = useHrTechnicalStore(s => s.copyVersion)
  const updateVersion = useHrTechnicalStore(s => s.updateVersion)
  const setShowNewVersionModal = useHrTechnicalStore(s => s.setShowNewVersionModal)
  const setShowVersionDetailModal = useHrTechnicalStore(s => s.setShowVersionDetailModal)
  const setEditingVersionId = useHrTechnicalStore(s => s.setEditingVersionId)
  const setVersionDetailReadOnly = useHrTechnicalStore(s => s.setVersionDetailReadOnly)
  const setShowVersionHistoryModal = useHrTechnicalStore(s => s.setShowVersionHistoryModal)
  const setEditingHistoryVersionId = useHrTechnicalStore(s => s.setEditingHistoryVersionId)

  // ── 筛选器选项 ────────────────────────────────────────────────────
  const projectNameOptions = useMemo(
    () => projects.map(p => ({ label: p.tdtName, value: p.tdtName })),
    [projects],
  )

  // ── 扁平化所有版本 ────────────────────────────────────────────────
  const allFlatVersions = useMemo<FlatVersionRow[]>(() => {
    const rows: FlatVersionRow[] = []
    for (const project of projects) {
      const source = project.ipmProjectCode ? resolveHrFormalSource('technical', project.ipmProjectCode) : null
      for (const version of project.versions) {
        rows.push({
          ...version,
          isLatest: isLatestHrVersion(project, version),
          isBound: !!project.ipmProjectCode,
          sourceHint: version.budgetType !== 'annual' && isLatestHrVersion(project, version) && source
            ? !source.project ? '请重新绑定正式项目' : !source.planVersion ? '等待主市场／主类型一级计划发布' : ''
            : '',
          projectName: project.tdtName,
          projectStatus: project.status,
        })
      }
    }
    return rows
  }, [projects])

  // ── 应用筛选器 ────────────────────────────────────────────────────
  const filteredVersions = useMemo<FlatVersionRow[]>(() => {
    const f = historyVersionFilters
    const typeOrder = (bt: BudgetType) => TECH_BUDGET_TYPES.findIndex(t => t.value === bt)

    return allFlatVersions
      .filter(row => {
        if (f.budgetType.length > 0 && !f.budgetType.includes(row.budgetType)) return false
        if (f.projectName.length > 0 && !f.projectName.includes(row.projectName)) return false
        return true
      })
      .sort((a, b) => {
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
    const milestoneColumns: ColumnsType<FlatVersionRow> = TECH_MILESTONE_FIELDS.map(field => ({
      title: field.label,
      key: field.key,
      width: 120,
      align: 'center',
      render: (_value: unknown, record: FlatVersionRow) => (
        <EditableDateCell
          value={record.milestones[field.key]}
          editable={record.isLatest && (record.budgetType === 'annual' || !record.isBound)}
          onSave={v =>
            updateVersion(record.projectId, record.id, {
              milestones: { [field.key]: v } as Partial<TechMilestoneNodes>,
            })
          }
        />
      ),
    }))

    return [
      {
        title: 'TDT项目名称',
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
          <Tag color={TECH_BUDGET_TYPE_COLORS[record.budgetType]}>
            {TECH_BUDGET_TYPE_LABELS[record.budgetType]}
          </Tag>
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
        render: (_value: unknown, record: FlatVersionRow) => (
          <span style={{ color: 'var(--pms-text-secondary)' }}>{record.createdBy}</span>
        ),
      },
      {
        title: '创建日期',
        key: 'createdAt',
        width: 180,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <span style={{ color: 'var(--pms-text-secondary)' }}>{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
        ),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 420,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => {
          const project = projects.find(p => p.id === record.projectId)
          const isActive = project?.status === 'active'
          return (
            <Space size={4} wrap>
              {/* 查看 */}
              <Tooltip title="查看本版本各部门预估投入">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedProjectId(record.projectId)
                    setEditingVersionId(record.id)
                    setVersionDetailReadOnly(true)
                    setShowVersionDetailModal(true)
                  }}
                >
                  查看
                </Button>
              </Tooltip>
              {/* 编辑 */}
              {record.isLatest && isActive ? (
                <Tooltip title="编辑各部门各阶段预估投入">
                  <Button
                    type="default"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedProjectId(record.projectId)
                      setEditingVersionId(record.id)
                      setVersionDetailReadOnly(false)
                      setShowVersionDetailModal(true)
                    }}
                  >
                    编辑
                  </Button>
                </Tooltip>
              ) : null}
              {/* 复制 */}
              {isActive ? (
                <Tooltip title="复制此版本创建新版本">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={e => {
                      e.stopPropagation()
                      copyVersion(record.projectId, record.id)
                      message.success('版本已复制')
                    }}
                  >
                    复制
                  </Button>
                </Tooltip>
              ) : null}
              {/* 删除 */}
              <Popconfirm
                title="删除版本数据"
                description="删除后不可恢复；若所有版本均被删除，该项目将一并删除。"
                okText="确认删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => {
                  if (!project) return
                  const remaining = project.versions.filter(v => v.id !== record.id)
                  deleteVersion(record.projectId, record.id)
                  if (remaining.length === 0) {
                    deleteProject(record.projectId)
                    message.success('所有版本已删除，项目已一并删除')
                  } else {
                    message.success('版本已删除')
                  }
                }}
              >
                <Button danger size="small" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>
                  删除
                </Button>
              </Popconfirm>
              {/* 历史 */}
              <Tooltip title="查看版本操作历史">
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedProjectId(record.projectId)
                    setEditingHistoryVersionId(record.id)
                    setShowVersionHistoryModal(true)
                  }}
                >
                  历史
                </Button>
              </Tooltip>
            </Space>
          )
        },
      },
    ]
  }, [projects, copyVersion, deleteVersion, deleteProject, updateVersion, setShowVersionDetailModal, setShowVersionHistoryModal, setEditingVersionId, setEditingHistoryVersionId, setVersionDetailReadOnly, setSelectedProjectId])

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = () => {
    const sheet1Columns: ExportColumn[] = [
      { key: 'projectName', title: 'TDT项目名称' },
      { key: 'budgetType', title: '预算类型', formatter: (_v: unknown, row: FlatVersionRow) => TECH_BUDGET_TYPE_LABELS[row.budgetType] },
      { key: 'versionNumber', title: '版本号' },
      { key: 'estimatedInvestment', title: '预估投入(人月)' },
      ...TECH_MILESTONE_FIELDS.map(f => ({
        key: f.key as string,
        title: f.label,
        formatter: (_v: unknown, row: FlatVersionRow) => row.milestones[f.key] ?? '',
      })),
      { key: 'createdBy', title: '创建人' },
      { key: 'createdAt', title: '创建日期', formatter: (_v: unknown, row: FlatVersionRow) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') },
    ]

    const sheet2Rows: Sheet2Row[] = []
    for (const ver of filteredVersions) {
      for (const dept of ver.departmentInvestments) {
        sheet2Rows.push({
          ...dept,
          projectName: ver.projectName,
          versionNumber: ver.versionNumber,
          budgetTypeLabel: TECH_BUDGET_TYPE_LABELS[ver.budgetType],
        })
      }
    }

    const sheet2Columns: ExportColumn[] = [
      { key: 'projectName', title: 'TDT项目名称' },
      { key: 'primaryDepartment', title: '一级部门' },
      { key: 'secondaryDepartment', title: '二级部门' },
      ...TECH_PHASE_INVESTMENT_FIELDS.map(f => ({
        key: f.key as string,
        title: f.label,
      })),
      { key: 'estimatedInvestment', title: '预估投入合计' },
      { key: 'versionNumber', title: '版本号' },
      { key: 'budgetTypeLabel', title: '预算类型' },
    ]

    exportMultiSheet(
      [
        { rows: filteredVersions as unknown as Record<string, unknown>[], columns: sheet1Columns, sheetName: '项目预估投入列表' },
        { rows: sheet2Rows as unknown as Record<string, unknown>[], columns: sheet2Columns, sheetName: '部门阶段预估投入明细' },
      ],
      `技术项目预估投入_${exportTimestamp()}.xlsx`,
    )
  }

  return (
    <div className="pms-hr-tech-history-version">
      {/* 筛选器工具条 */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ borderRadius: 8, marginBottom: 12 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Space size={12} wrap style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>预算类型</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择预算类型"
              style={{ minWidth: 180 }}
              maxTagCount="responsive"
              value={historyVersionFilters.budgetType}
              onChange={v => setHistoryVersionFilters({ budgetType: v as BudgetType[] })}
              options={TECH_BUDGET_TYPES}
              optionFilterProp="label"
            />

            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>TDT项目名称</span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择项目名称"
              style={{ minWidth: 200 }}
              maxTagCount="responsive"
              value={historyVersionFilters.projectName}
              onChange={v => setHistoryVersionFilters({ projectName: v as string[] })}
              options={projectNameOptions}
              optionFilterProp="label"
            />


            <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
              共 {filteredVersions.length} 条版本
            </span>
          </Space>

          <Space size={8} style={{ flexShrink: 0 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowNewVersionModal(true)}
            >
              新增版本
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
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
        pagination={{ pageSize: 15, showTotal: t => '共 ' + t + ' 条版本' }}
        rowClassName={record => {
          const budgetClass = TECH_BUDGET_TYPE_ROW_CLASS[record.budgetType] ?? ''
          return budgetClass
        }}
        locale={{ emptyText: '当前筛选条件下暂无版本数据' }}
      />

      <style jsx global>{`
        .pms-hr-tech-history-version .pms-table .ant-table-tbody > tr.hr-tech-budget-annual > td {
          background: #f8f5fd !important;
        }
        .pms-hr-tech-history-version .pms-table .ant-table-tbody > tr.hr-tech-budget-estimate > td {
          background: #fffbf4 !important;
        }
        .pms-hr-tech-history-version .pms-table .ant-table-tbody > tr.hr-tech-budget-budget > td {
          background: #f6fcf3 !important;
        }
        .pms-hr-tech-history-version .pms-inline-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
          display: inline-block;
          min-width: 24px;
          text-align: center;
        }
        .pms-hr-tech-history-version .pms-inline-editable:hover {
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }
        .pms-hr-tech-history-version .pms-table .ant-picker {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
