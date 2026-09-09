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
import { canCreateHrVersion, isLatestHrVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import {
  CAPABILITY_IPM_REQUIRED_TIP,
  CAPABILITY_BUDGET_TYPES,
  CAPABILITY_BUDGET_TYPE_LABELS,
  CAPABILITY_BUDGET_TYPE_COLORS,
  CAPABILITY_BUDGET_TYPE_ROW_CLASS,
  CAPABILITY_PROJECT_YEAR_OPTIONS,
  formatPersonMonth,
} from '@/constants/hrCapability'
import type {
  HrCapabilityVersion,
  HrCapabilityProject,
  BudgetType,
} from '@/types/hrCapability'
import { exportMultiSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

/** 扁平化版本行：版本数据 + 所属项目信息 */
interface FlatVersionRow extends HrCapabilityVersion {
  projectName: string
  isLatest: boolean
  isBound: boolean
  sourceHint: string
  projectTarget: string
  projectStatus: HrCapabilityProject['status']
}

/** Sheet2 行类型：部门投入 + 项目/版本信息 */
interface Sheet2Row {
  projectName: string
  primaryDepartment: string
  secondaryDepartment: string
  estimatedInvestment: number
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

export default function HistoryVersionSpace() {
  const { message } = App.useApp()
  // ── Store ──────────────────────────────────────────────────────────
  const projects = useHrCapabilityStore((s) => s.projects)
  const historyVersionFilters = useHrCapabilityStore((s) => s.historyVersionFilters)
  const setHistoryVersionFilters = useHrCapabilityStore((s) => s.setHistoryVersionFilters)
  const selectedProjectId = useHrCapabilityStore((s) => s.selectedProjectId)
  const setSelectedProjectId = useHrCapabilityStore((s) => s.setSelectedProjectId)
  const deleteVersion = useHrCapabilityStore((s) => s.deleteVersion)
  const deleteProject = useHrCapabilityStore((s) => s.deleteProject)
  const copyVersion = useHrCapabilityStore((s) => s.copyVersion)
  const updateVersion = useHrCapabilityStore((s) => s.updateVersion)
  const setShowNewVersionModal = useHrCapabilityStore((s) => s.setShowNewVersionModal)
  const setShowVersionDetailModal = useHrCapabilityStore((s) => s.setShowVersionDetailModal)
  const setEditingVersionId = useHrCapabilityStore((s) => s.setEditingVersionId)
  const setVersionDetailReadOnly = useHrCapabilityStore((s) => s.setVersionDetailReadOnly)
  const setShowVersionHistoryModal = useHrCapabilityStore((s) => s.setShowVersionHistoryModal)
  const setHistoryVersionId = useHrCapabilityStore((s) => s.setHistoryVersionId)

  // ── 筛选器选项 ────────────────────────────────────────────────────
  const projectNameOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: p.name })),
    [projects],
  )

  // ── 扁平化所有版本 ────────────────────────────────────────────────
  const allFlatVersions = useMemo<FlatVersionRow[]>(() => {
    const rows: FlatVersionRow[] = []
    for (const project of projects) {
      const source = project.ipmProjectCode ? resolveHrFormalSource('capability', project.ipmProjectCode) : null
      for (const version of project.versions) {
        rows.push({
          ...version,
          isLatest: isLatestHrVersion(project, version),
          isBound: !!project.ipmProjectCode,
          sourceHint: version.budgetType !== 'annual' && isLatestHrVersion(project, version) && source
            ? !source.project ? '请重新绑定正式项目' : !source.planVersion ? '等待主市场／主类型一级计划发布' : ''
            : '',
          projectName: project.name,
          projectTarget: project.projectTarget,
          projectStatus: project.status,
        })
      }
    }
    return rows
  }, [projects])

  // ── 应用筛选器 ────────────────────────────────────────────────────
  const filteredVersions = useMemo<FlatVersionRow[]>(() => {
    const f = historyVersionFilters
    const typeOrder = (bt: BudgetType) => CAPABILITY_BUDGET_TYPES.findIndex((t) => t.value === bt)

    return allFlatVersions
      .filter((row) => {
        if (f.budgetType.length > 0 && !f.budgetType.includes(row.budgetType)) return false
        if (f.projectName.length > 0 && !f.projectName.includes(row.projectName)) return false
        if (f.projectYear.length > 0) {
          const year = row.projectStartTime ? row.projectStartTime.slice(0, 4) : ''
          if (!f.projectYear.includes(year)) return false
        }
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
          <Tag color={CAPABILITY_BUDGET_TYPE_COLORS[record.budgetType]}>
            {CAPABILITY_BUDGET_TYPE_LABELS[record.budgetType]}
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
        title: '项目目标',
        key: 'projectTarget',
        width: 200,
        ellipsis: true,
        render: (_value: unknown, record: FlatVersionRow) => (
          <Tooltip title={record.projectTarget}>
            <span style={{ color: 'var(--pms-text-primary)' }}>{record.projectTarget}</span>
          </Tooltip>
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
      {
        title: '项目开始时间',
        key: 'projectStartTime',
        width: 140,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <EditableDateCell
            value={record.projectStartTime}
            editable={record.isLatest && (record.budgetType === 'annual' || !record.isBound)}
            onSave={(v) =>
              updateVersion(record.projectId, record.id, {
                projectStartTime: v ?? '',
              })
            }
          />
        ),
      },
      {
        title: '项目结束时间',
        key: 'projectEndTime',
        width: 140,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <EditableDateCell
            value={record.projectEndTime}
            editable={record.isLatest && (record.budgetType === 'annual' || !record.isBound)}
            onSave={(v) =>
              updateVersion(record.projectId, record.id, {
                projectEndTime: v ?? '',
              })
            }
          />
        ),
      },
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
          <span style={{ color: 'var(--pms-text-secondary)' }}>
            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        ),
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 208,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => {
          const project = projects.find((p) => p.id === record.projectId)
          return (
            <Space size={4}>
              <Tooltip title="查看本版本各部门预估投入">
                <Button
                  type="text" aria-label="查看"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedProjectId(record.projectId)
                    setEditingVersionId(record.id)
                    setVersionDetailReadOnly(true)
                    setShowVersionDetailModal(true)
                  }}
                />
              </Tooltip>
              {record.isLatest && project?.status === 'active' ? (
                <Tooltip title="编辑版本信息及各部门预估投入">
                  <Button
                    type="text" aria-label="编辑"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedProjectId(record.projectId)
                      setEditingVersionId(record.id)
                      setVersionDetailReadOnly(false)
                      setShowVersionDetailModal(true)
                    }}
                  />
                </Tooltip>
              ) : null}
              {project?.status === 'active' ? (
                <Tooltip title={canCreateHrVersion(project, record.budgetType) ? '复制此版本创建新版本' : CAPABILITY_IPM_REQUIRED_TIP}>
                  <Button
                    type="text" aria-label="复制"
                    disabled={!canCreateHrVersion(project, record.budgetType)}
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      copyVersion(record.projectId, record.id)
                      message.success('版本已复制')
                    }}
                  />
                </Tooltip>
              ) : null}
              <Tooltip title="查看版本操作历史">
                <Button
                  type="text" aria-label="历史"
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedProjectId(record.projectId)
                    setHistoryVersionId(record.id)
                    setShowVersionHistoryModal(true)
                  }}
                />
              </Tooltip>
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
                <Button type="text" aria-label="删除" title="删除"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          )
        },
      },
    ]
  }, [projects, deleteVersion, deleteProject, copyVersion, updateVersion, setShowVersionDetailModal, setEditingVersionId, setSelectedProjectId, setShowVersionHistoryModal, setHistoryVersionId])

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = () => {
    // Sheet1: 项目预估投入列表
    const sheet1Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称' },
      { key: 'budgetType', title: '预算类型', formatter: (_v: unknown, row: FlatVersionRow) => CAPABILITY_BUDGET_TYPE_LABELS[row.budgetType] },
      { key: 'versionNumber', title: '版本号' },
      { key: 'projectTarget', title: '项目目标' },
      { key: 'estimatedInvestment', title: '预估投入(人月)' },
      { key: 'projectStartTime', title: '项目开始时间' },
      { key: 'projectEndTime', title: '项目结束时间' },
      { key: 'createdBy', title: '创建人' },
      { key: 'createdAt', title: '创建日期', formatter: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss') },
    ]

    // Sheet2: 各项目各部门预估投入明细
    const sheet2Rows: Sheet2Row[] = []
    for (const ver of filteredVersions) {
      for (const dept of ver.departmentInvestments) {
        sheet2Rows.push({
          projectName: ver.projectName,
          primaryDepartment: dept.primaryDepartment,
          secondaryDepartment: dept.secondaryDepartment,
          estimatedInvestment: dept.estimatedInvestment,
          versionNumber: ver.versionNumber,
          budgetTypeLabel: CAPABILITY_BUDGET_TYPE_LABELS[ver.budgetType],
        })
      }
    }

    const sheet2Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称' },
      { key: 'primaryDepartment', title: '一级部门' },
      { key: 'secondaryDepartment', title: '二级部门' },
      { key: 'estimatedInvestment', title: '预估投入' },
      { key: 'versionNumber', title: '版本号' },
      { key: 'budgetTypeLabel', title: '预算类型' },
    ]

    exportMultiSheet(
      [
        { rows: filteredVersions as unknown as Record<string, unknown>[], columns: sheet1Columns, sheetName: '项目预估投入列表' },
        { rows: sheet2Rows as unknown as Record<string, unknown>[], columns: sheet2Columns, sheetName: '部门预估投入明细' },
      ],
      `能力建设项目预估投入_${exportTimestamp()}.xlsx`,
    )
  }

  return (
    <div className="pms-hr-capability-history-version">
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
                options={CAPABILITY_BUDGET_TYPES}
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
                项目年度
              </span>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择年度"
                style={{ minWidth: 140 }}
                maxTagCount="responsive"
                value={historyVersionFilters.projectYear}
                onChange={(v) => setHistoryVersionFilters({ projectYear: v as string[] })}
                options={CAPABILITY_PROJECT_YEAR_OPTIONS}
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
        className="pms-table pms-hr-investment-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredVersions}
        tableLayout="fixed"
        scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
        pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条版本' }}
        rowClassName={(record) => {
          const budgetClass = CAPABILITY_BUDGET_TYPE_ROW_CLASS[record.budgetType] ?? ''
          return budgetClass
        }}
        locale={{ emptyText: '当前筛选条件下暂无版本数据' }}
      />

      <style jsx global>{`
        .pms-hr-capability-history-version .pms-table .ant-table-tbody > tr.hr-capability-budget-annual > td {
          background: #f8f5fd !important;
        }
        .pms-hr-capability-history-version .pms-table .ant-table-tbody > tr.hr-capability-budget-estimate > td {
          background: #fffbf4 !important;
        }
        .pms-hr-capability-history-version .pms-table .ant-table-tbody > tr.hr-capability-budget-budget > td {
          background: #f6fcf3 !important;
        }
        .pms-hr-capability-history-version .pms-inline-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
          display: inline-block;
          min-width: 24px;
          text-align: center;
        }
        .pms-hr-capability-history-version .pms-inline-editable:hover {
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }
        .pms-hr-capability-history-version .pms-table .ant-picker {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
