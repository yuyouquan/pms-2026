'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useHrTosStore } from '@/stores/hrTos'
import {
  TOS_BUDGET_TYPES,
  TOS_BUDGET_TYPE_LABELS,
  TOS_BUDGET_TYPE_COLORS,
  TOS_BUDGET_TYPE_ROW_CLASS,
  formatPersonMonth,
  TOS_MILESTONE_FIELDS,
  TOS_PHASE_INVESTMENT_FIELDS,
  TOS_LOCK_STATE_OPTIONS,
} from '@/constants/hrTos'
import type {
  HrTosVersion,
  HrTosProject,
  BudgetType,
  TosMilestoneNodes,
  TosDepartmentInvestment,
  VersionLockState,
} from '@/types/hrTos'
import { exportMultiSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

/** 扁平化版本行：版本数据 + 所属项目信息 */
interface FlatVersionRow extends HrTosVersion {
  projectName: string
  projectTarget: string
  projectStatus: HrTosProject['status']
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

/** Sheet2 行类型：部门投入 + 项目/版本信息 */
interface Sheet2Row extends TosDepartmentInvestment {
  projectName: string
  versionNumber: string
  budgetTypeLabel: string
}

export default function HistoryVersionSpace() {
  // ── Store ──────────────────────────────────────────────────────────
  const projects = useHrTosStore((s) => s.projects)
  const historyVersionFilters = useHrTosStore((s) => s.historyVersionFilters)
  const setHistoryVersionFilters = useHrTosStore((s) => s.setHistoryVersionFilters)
  const selectedProjectId = useHrTosStore((s) => s.selectedProjectId)
  const setSelectedProjectId = useHrTosStore((s) => s.setSelectedProjectId)
  const lockVersion = useHrTosStore((s) => s.lockVersion)
  const unlockVersion = useHrTosStore((s) => s.unlockVersion)
  const deleteVersion = useHrTosStore((s) => s.deleteVersion)
  const deleteProject = useHrTosStore((s) => s.deleteProject)
  const updateVersion = useHrTosStore((s) => s.updateVersion)
  const setShowNewVersionModal = useHrTosStore((s) => s.setShowNewVersionModal)
  const setShowVersionDetailModal = useHrTosStore((s) => s.setShowVersionDetailModal)
  const setEditingVersionId = useHrTosStore((s) => s.setEditingVersionId)
  const setVersionDetailReadOnly = useHrTosStore((s) => s.setVersionDetailReadOnly)

  // ── 筛选器选项 ────────────────────────────────────────────────────
  const projectNameOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: p.name })),
    [projects],
  )

  // ── 扁平化所有版本 ────────────────────────────────────────────────
  const allFlatVersions = useMemo<FlatVersionRow[]>(() => {
    const rows: FlatVersionRow[] = []
    for (const project of projects) {
      for (const version of project.versions) {
        rows.push({
          ...version,
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
    const typeOrder = (bt: BudgetType) => TOS_BUDGET_TYPES.findIndex((t) => t.value === bt)

    return allFlatVersions
      .filter((row) => {
        if (f.budgetType.length > 0 && !f.budgetType.includes(row.budgetType)) return false
        if (f.projectName.length > 0 && !f.projectName.includes(row.projectName)) return false
        if (f.lockState.length > 0 && !f.lockState.includes(row.lockState)) return false
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

  // ── 可锁定版本判定（跨项目，每个项目每个预算类型仅最新未锁定版本可锁定） ──
  const lockableIds = useMemo(() => {
    const lockable = new Set<string>()
    const budgetTypes: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']
    for (const project of projects) {
      for (const bt of budgetTypes) {
        const versionsOfType = project.versions
          .filter((v) => v.budgetType === bt)
          .sort((a, b) => b.minorVersion - a.minorVersion)
        const latest = versionsOfType[0]
        if (latest && latest.lockState === 'unlocked') {
          lockable.add(latest.id)
        }
      }
    }
    return lockable
  }, [projects])

  // ── 列定义 ────────────────────────────────────────────────────────
  const columns = useMemo<ColumnsType<FlatVersionRow>>(() => {
    const milestoneColumns: ColumnsType<FlatVersionRow> = TOS_MILESTONE_FIELDS.map((field) => ({
      title: field.label,
      key: field.key,
      width: 120,
      align: 'center',
      render: (_value: unknown, record: FlatVersionRow) => (
        <EditableDateCell
          value={record.milestones[field.key]}
          editable={record.lockState === 'unlocked'}
          onSave={(v) =>
            updateVersion(record.projectId, record.id, {
              milestones: { [field.key]: v } as Partial<TosMilestoneNodes>,
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
          <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>
            {record.projectName}
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
      ...milestoneColumns,
      {
        title: '预算类型',
        key: 'budgetType',
        width: 100,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <Tag color={TOS_BUDGET_TYPE_COLORS[record.budgetType]}>
            {TOS_BUDGET_TYPE_LABELS[record.budgetType]}
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
        width: 110,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => (
          <span style={{ color: 'var(--pms-text-secondary)' }}>{record.createdAt}</span>
        ),
      },
      {
        title: '版本锁定',
        key: 'versionLock',
        width: 100,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => {
          if (record.lockState === 'locked') {
            return (
              <Tag icon={<LockOutlined />} color="default">
                已锁定
              </Tag>
            )
          }
          return <Tag color="processing">编辑中</Tag>
        },
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 310,
        align: 'center',
        render: (_value: unknown, record: FlatVersionRow) => {
          const project = projects.find((p) => p.id === record.projectId)
          return (
            <Space size={4}>
              <Tooltip title="查看本版本各部门预估投入">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
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
              {record.lockState === 'unlocked' && project?.status === 'active' ? (
                <Tooltip title="编辑各部门各阶段预估投入">
                  <Button
                    type="default"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
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
              {lockableIds.has(record.id) && project?.status === 'active' ? (
                <Tooltip title="锁定后该版本将变为只读，不可再编辑">
                  <Button
                    type="primary"
                    size="small"
                    icon={<LockOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      lockVersion(record.projectId, record.id)
                      message.success('版本已锁定')
                    }}
                  >
                    锁定
                  </Button>
                </Tooltip>
              ) : null}
              {record.lockState === 'locked' ? (
                <Popconfirm
                  title="解锁版本"
                  description="解锁后该版本可继续编辑。"
                  okText="确认解锁"
                  cancelText="取消"
                  onConfirm={() => {
                    unlockVersion(record.projectId, record.id)
                    message.success('版本已解锁')
                  }}
                >
                  <Button
                    size="small"
                    icon={<UnlockOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  >
                    解锁
                  </Button>
                </Popconfirm>
              ) : null}
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
  }, [projects, lockableIds, lockVersion, unlockVersion, deleteVersion, deleteProject, updateVersion, setShowVersionDetailModal, setEditingVersionId, setVersionDetailReadOnly, setSelectedProjectId])

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = () => {
    // Sheet1: 项目预估投入列表
    const sheet1Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称' },
      { key: 'projectTarget', title: '项目目标' },
      { key: 'estimatedInvestment', title: '预估投入(人月)' },
      ...TOS_MILESTONE_FIELDS.map((f) => ({
        key: f.key as string,
        title: f.label,
      })),
      { key: 'budgetType', title: '预算类型', formatter: (_v: unknown, row: FlatVersionRow) => TOS_BUDGET_TYPE_LABELS[row.budgetType] },
      { key: 'versionNumber', title: '版本号' },
      { key: 'createdBy', title: '创建人' },
      { key: 'createdAt', title: '创建日期' },
      { key: 'lockState', title: '版本锁定', formatter: (_v: unknown, row: FlatVersionRow) => (row.lockState === 'locked' ? '已锁定' : '编辑中') },
    ]

    // Sheet2: 各项目各一级部门各二级部门各阶段的预估投入明细
    const sheet2Rows: Sheet2Row[] = []
    for (const ver of filteredVersions) {
      for (const dept of ver.departmentInvestments) {
        sheet2Rows.push({
          ...dept,
          projectName: ver.projectName,
          versionNumber: ver.versionNumber,
          budgetTypeLabel: TOS_BUDGET_TYPE_LABELS[ver.budgetType],
        })
      }
    }

    const sheet2Columns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称' },
      { key: 'primaryDepartment', title: '一级部门' },
      { key: 'secondaryDepartment', title: '二级部门' },
      ...TOS_PHASE_INVESTMENT_FIELDS.map((f) => ({
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
      `tOS项目预估投入_${exportTimestamp()}.xlsx`,
    )
  }

  return (
    <div className="pms-hr-tos-history-version">
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
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space size={12} wrap>
            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
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
              options={TOS_BUDGET_TYPES}
              optionFilterProp="label"
            />

            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
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

            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
              是否锁定
            </span>
            <Select
              mode="multiple"
              allowClear
              placeholder="选择锁定状态"
              style={{ minWidth: 140 }}
              maxTagCount="responsive"
              value={historyVersionFilters.lockState}
              onChange={(v) => setHistoryVersionFilters({ lockState: v as VersionLockState[] })}
              options={TOS_LOCK_STATE_OPTIONS}
              optionFilterProp="label"
            />

            <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
              共 {filteredVersions.length} 条版本
            </span>
          </Space>

          <Space size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowNewVersionModal(true)}
              disabled={!selectedProjectId}
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
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条版本' }}
        rowClassName={(record) => {
          const budgetClass = TOS_BUDGET_TYPE_ROW_CLASS[record.budgetType] ?? ''
          const lockedClass = record.lockState === 'locked' ? 'hr-tos-version-locked' : ''
          return `${budgetClass} ${lockedClass}`.trim()
        }}
        locale={{ emptyText: '当前筛选条件下暂无版本数据' }}
      />

      <style jsx global>{`
        .pms-hr-tos-history-version .pms-table .ant-table-tbody > tr.hr-tos-budget-annual > td {
          background: rgba(114, 46, 209, 0.05) !important;
        }
        .pms-hr-tos-history-version .pms-table .ant-table-tbody > tr.hr-tos-budget-estimate > td {
          background: rgba(245, 154, 35, 0.05) !important;
        }
        .pms-hr-tos-history-version .pms-table .ant-table-tbody > tr.hr-tos-budget-budget > td {
          background: rgba(82, 196, 26, 0.05) !important;
        }
        .pms-hr-tos-history-version .pms-table .ant-table-tbody > tr.hr-tos-version-locked > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-brand-strong);
          font-weight: 500;
        }
        .pms-hr-tos-history-version .pms-table .ant-table-tbody > tr.hr-tos-version-locked:hover > td {
          background: color-mix(in srgb, var(--pms-brand-surface) 72%, #ffffff) !important;
        }
        .pms-hr-tos-history-version .pms-inline-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
          display: inline-block;
          min-width: 24px;
          text-align: center;
        }
        .pms-hr-tos-history-version .pms-inline-editable:hover {
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }
        .pms-hr-tos-history-version .pms-table .ant-picker {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
