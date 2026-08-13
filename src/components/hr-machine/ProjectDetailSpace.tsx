'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Checkbox,
  Tag,
  Modal,
  message,
  Popconfirm,
  Tooltip,
  InputNumber,
  DatePicker,
  Select,
  Popover,
  Alert,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  LockOutlined,
  DeleteOutlined,
  ExportOutlined,
  StopOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useHrMachineStore } from '@/stores/hrMachine'
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  formatPersonMonth,
  MILESTONE_FIELDS,
  IPM_PROJECTS,
} from '@/constants/hrMachine'
import type { HrMachineVersion, BudgetType, MilestoneNodes } from '@/types/hrMachine'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import { useHrConfigStore } from '@/stores/hrConfig'
import { getConfigProjectLevels, getConfigModelVersions } from '@/constants/hrConfig'

interface ProjectDetailSpaceProps {
  projectId: string
  onBack: () => void
  onNewVersion: () => void
}

/** 预算类型筛选选项（由常量派生，无需每次渲染重建） */
const BUDGET_TYPE_OPTIONS = BUDGET_TYPES.map((t) => ({ label: t.label, value: t.value }))

/** 全部预算类型值（用于全选） */
const ALL_BUDGET_TYPE_VALUES = BUDGET_TYPE_OPTIONS.map((o) => o.value) as BudgetType[]

// ── 行内编辑：数字单元格（等级系数等） ──────────────────────────────────
// 点击进入编辑模式，Enter / blur 保存，Escape 取消
function EditableNumberCell({
  value,
  editable,
  onSave,
  formatter = formatPersonMonth,
}: {
  value: number
  editable: boolean
  onSave: (v: number) => void
  formatter?: (v: number) => string
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  if (!editable) {
    return <span style={{ fontWeight: 600 }}>{formatter(value)}</span>
  }

  if (editing) {
    return (
      <InputNumber
        size="small"
        value={localValue}
        min={0}
        step={0.1}
        precision={1}
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
        setLocalValue(value)
        setEditing(true)
      }}
      style={{ fontWeight: 600 }}
    >
      {formatter(value)}
    </span>
  )
}

// ── 行内编辑：日期单元格（里程碑节点） ────────────────────────────────
// 点击进入编辑模式，选择日期即保存，关闭弹层则取消
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

// ── 行内编辑：下拉选择单元格（项目等级、人力模型版本号） ────────────────
// 点击进入编辑模式，选择后自动保存，关闭弹层则取消
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
        onDropdownVisibleChange={(visible) => {
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

export default function ProjectDetailSpace({ projectId, onBack, onNewVersion }: ProjectDetailSpaceProps) {
  // ── Store：读取项目、预算类型筛选与版本操作 ──────────────────────────
  const projects = useHrMachineStore((s) => s.projects)
  const selectedBudgetTypes = useHrMachineStore((s) => s.selectedBudgetTypes)
  const setSelectedBudgetTypes = useHrMachineStore((s) => s.setSelectedBudgetTypes)
  const lockVersion = useHrMachineStore((s) => s.lockVersion)
  const deleteVersion = useHrMachineStore((s) => s.deleteVersion)
  const cancelProject = useHrMachineStore((s) => s.cancelProject)
  const restoreProject = useHrMachineStore((s) => s.restoreProject)
  const deleteProject = useHrMachineStore((s) => s.deleteProject)
  const updateVersion = useHrMachineStore((s) => s.updateVersion)
  const bindIpmProject = useHrMachineStore((s) => s.bindIpmProject)

  // ── 配置中心：项目等级 / 人力模型版本号选项 ──────────────────────────
  const hrModelRecords = useHrConfigStore((s) => s.data.hrModel ?? [])
  const projectLevelOptions = useMemo(
    () => getConfigProjectLevels(hrModelRecords).map((v) => ({ label: v, value: v })),
    [hrModelRecords],
  )
  const modelVersionOptions = useMemo(
    () => getConfigModelVersions(hrModelRecords).map((v) => ({ label: v, value: v })),
    [hrModelRecords],
  )

  // ── 当前项目 ────────────────────────────────────────────────────────
  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  // ── 按预算类型筛选版本，并按 预算类型 → 版本号降序 排序 ──────────────
  const filteredVersions = useMemo<HrMachineVersion[]>(() => {
    if (!project) return []
    const typeOrder = (bt: BudgetType) => BUDGET_TYPES.findIndex((t) => t.value === bt)
    return project.versions
      .filter((v) => selectedBudgetTypes.includes(v.budgetType))
      .sort((a, b) => {
        const byType = typeOrder(a.budgetType) - typeOrder(b.budgetType)
        if (byType !== 0) return byType
        // 同一预算类型下按版本号降序（最新版本在最前）
        if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion
        return b.minorVersion - a.minorVersion
      })
  }, [project, selectedBudgetTypes])

  // ── 可锁定版本判定（需求 3.2） ──────────────────────────────────────
  // 规则：每个预算类型下，仅最新版本（minorVersion 最高）且未锁定时可锁定。
  // 当最新版本被删除后，锁定按钮自动转移到新的最新版本（自然重算）。
  const lockableIds = useMemo(() => {
    const lockable = new Set<string>()
    if (!project) return lockable
    const budgetTypes: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']
    for (const bt of budgetTypes) {
      const versionsOfType = project.versions
        .filter((v) => v.budgetType === bt)
        .sort((a, b) => b.minorVersion - a.minorVersion)
      const latest = versionsOfType[0]
      if (latest && latest.lockState === 'unlocked') {
        lockable.add(latest.id)
      }
    }
    return lockable
  }, [project])

  // ── IPM 绑定弹层状态 ────────────────────────────────────────────────
  const [ipmPopoverOpen, setIpmPopoverOpen] = useState(false)
  const [ipmSelectValue, setIpmSelectValue] = useState<string | undefined>(undefined)

  // ── 项目状态切换弹窗 ────────────────────────────────────────────────
  const [statusModalOpen, setStatusModalOpen] = useState(false)

  // ── 列定义（在早返回之前调用，遵守 Hooks 规则） ─────────────────────
  const columns = useMemo<ColumnsType<HrMachineVersion>>(() => {
    if (!project) return []

    // 里程碑列：由 MILESTONE_FIELDS 动态生成，支持行内编辑
    const milestoneColumns: ColumnsType<HrMachineVersion> = MILESTONE_FIELDS.map((field) => ({
      title: field.label,
      key: field.key,
      width: 120,
      align: 'center',
      render: (_value: unknown, record: HrMachineVersion) => (
        <EditableDateCell
          value={record.milestones[field.key]}
          editable={record.lockState === 'unlocked'}
          onSave={(v) =>
            updateVersion(project.id, record.id, {
              milestones: { [field.key]: v } as Partial<MilestoneNodes>,
            })
          }
        />
      ),
    }))

    return [
      {
        title: '项目名称',
        key: 'name',
        width: 170,
        fixed: 'left',
        render: () => (
          <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>{project.name}</span>
        ),
      },
      { title: '品牌', key: 'brand', width: 90, render: () => project.brand },
      { title: '产品线', key: 'productLine', width: 90, render: () => project.productLine },
      {
        title: '项目等级',
        key: 'projectLevel',
        width: 90,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => (
          <EditableSelectCell
            value={record.projectLevel}
            editable={record.lockState === 'unlocked'}
            options={projectLevelOptions}
            onSave={(v) => updateVersion(project.id, record.id, { projectLevel: v })}
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
        render: (_value: unknown, record: HrMachineVersion) => (
          <EditableNumberCell
            value={record.levelCoefficient}
            editable={record.lockState === 'unlocked'}
            formatter={(v) => v.toFixed(1)}
            onSave={(v) => updateVersion(project.id, record.id, { levelCoefficient: v })}
          />
        ),
      },
      {
        title: '人力模型版本',
        key: 'hrModelVersion',
        width: 120,
        render: (_value: unknown, record: HrMachineVersion) => (
          <EditableSelectCell
            value={record.hrModelVersion}
            editable={record.lockState === 'unlocked'}
            options={modelVersionOptions}
            onSave={(v) => updateVersion(project.id, record.id, { hrModelVersion: v })}
          />
        ),
      },
      {
        title: '预估投入',
        key: 'estimatedInvestment',
        width: 110,
        align: 'right',
        render: (_value: unknown, record: HrMachineVersion) => (
          <span style={{ fontWeight: 600 }}>{formatPersonMonth(record.estimatedInvestment)}</span>
        ),
      },
      ...milestoneColumns,
      {
        title: '预算类型',
        key: 'budgetType',
        width: 100,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => (
          <Tag color="purple">{BUDGET_TYPE_LABELS[record.budgetType]}</Tag>
        ),
      },
      {
        title: '版本号',
        key: 'versionNumber',
        width: 90,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => (
          <span style={{ fontWeight: 600, color: 'var(--pms-brand-strong)' }}>
            {record.versionNumber}
          </span>
        ),
      },
      {
        title: '版本锁定',
        key: 'versionLock',
        width: 100,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => {
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
        width: 170,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => (
          <Space size={4}>
            {lockableIds.has(record.id) && project.status === 'active' ? (
              <Tooltip title="锁定后该版本将变为只读，不可再编辑">
                <Button
                  type="primary"
                  size="small"
                  icon={<LockOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    lockVersion(project.id, record.id)
                    message.success('版本已锁定')
                  }}
                >
                  锁定
                </Button>
              </Tooltip>
            ) : null}
            <Popconfirm
              title="删除版本数据"
              description="删除后不可恢复；若所有版本均被删除，该项目将一并删除。"
              okText="确认删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => {
                const remaining = project.versions.filter((v) => v.id !== record.id)
                deleteVersion(project.id, record.id)
                if (remaining.length === 0) {
                  // 所有版本被删除 → 项目一并删除，并返回列表
                  deleteProject(project.id)
                  message.success('所有版本已删除，项目已一并删除')
                  onBack()
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
        ),
      },
    ]
  }, [project, lockableIds, lockVersion, deleteVersion, deleteProject, onBack, updateVersion, projectLevelOptions, modelVersionOptions])

  // ── 项目不存在的兜底 ────────────────────────────────────────────────
  if (!project) {
    return (
      <div className="pms-hr-machine-project-detail">
        <Card
          className="pms-toolbar"
          size="small"
          style={{ borderRadius: 8 }}
          styles={{ body: { padding: '16px' } }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
              返回
            </Button>
            <span style={{ color: 'var(--pms-text-secondary)' }}>项目不存在或已被删除</span>
          </Space>
        </Card>
      </div>
    )
  }

  // ── 导出当前筛选版本明细 ────────────────────────────────────────────
  const handleExport = () => {
    const exportColumns: ExportColumn[] = [
      { key: 'name', title: '项目名称', formatter: () => project.name },
      { key: 'brand', title: '品牌', formatter: () => project.brand },
      { key: 'productLine', title: '产品线', formatter: () => project.productLine },
      { key: 'projectLevel', title: '项目等级', formatter: (_v, row: HrMachineVersion) => row.projectLevel },
      { key: 'levelCoefficient', title: '等级系数', formatter: (_v, row: HrMachineVersion) => row.levelCoefficient },
      { key: 'hrModelVersion', title: '人力模型版本', formatter: (_v, row: HrMachineVersion) => row.hrModelVersion },
      {
        key: 'estimatedInvestment',
        title: '预估投入(人月)',
        formatter: (_v, row: HrMachineVersion) => row.estimatedInvestment,
      },
      ...MILESTONE_FIELDS.map((f) => ({
        key: f.key,
        title: f.label,
        formatter: (_v: unknown, row: HrMachineVersion) => row.milestones[f.key] ?? '',
      })),
      {
        key: 'budgetType',
        title: '预算类型',
        formatter: (_v, row: HrMachineVersion) => BUDGET_TYPE_LABELS[row.budgetType],
      },
      {
        key: 'versionNumber',
        title: '版本号',
        formatter: (_v, row: HrMachineVersion) => row.versionNumber,
      },
      {
        key: 'lockState',
        title: '版本锁定',
        formatter: (_v, row: HrMachineVersion) => (row.lockState === 'locked' ? '已锁定' : '编辑中'),
      },
    ]
    exportSheet(
      filteredVersions,
      exportColumns,
      `${project.name}_版本明细_${exportTimestamp()}.xlsx`,
      '版本明细',
    )
  }

  // ── 项目状态切换确认 ────────────────────────────────────────────────
  const handleStatusConfirm = () => {
    if (project.status === 'active') {
      cancelProject(project.id)
      message.success(`项目「${project.name}」已取消/暂停`)
    } else {
      restoreProject(project.id)
      message.success(`项目「${project.name}」已恢复`)
    }
    setStatusModalOpen(false)
  }

  // ── IPM 绑定确认 ────────────────────────────────────────────────────
  const handleIpmBind = () => {
    if (!ipmSelectValue) return
    bindIpmProject(project.id, ipmSelectValue)
    message.success('IPM编码绑定成功')
    setIpmSelectValue(undefined)
    setIpmPopoverOpen(false)
  }

  const hasIpm = !!project.ipmProjectCode

  return (
    <div className="pms-hr-machine-project-detail">
      {/* 顶部：返回 + 项目标题 + 状态 + IPM */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回
        </Button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--pms-text-primary)' }}>
          {project.name}
        </span>
        {project.status === 'cancelled' ? (
          <Tag color="red">已取消/暂停</Tag>
        ) : (
          <Tag color="green">进行中</Tag>
        )}
        <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13 }}>
          {project.brand} · {project.productLine} · 等级 {project.projectLevel}
        </span>

        {/* IPM 编码展示 / 绑定 */}
        {hasIpm ? (
          <Space size={4}>
            <Tag color="blue" icon={<LinkOutlined />}>
              {project.ipmProjectCode}
            </Tag>
            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13 }}>
              {project.ipmProjectName}
            </span>
          </Space>
        ) : (
          <Popover
            open={ipmPopoverOpen}
            onOpenChange={(open) => {
              setIpmPopoverOpen(open)
              if (!open) setIpmSelectValue(undefined)
            }}
            trigger="click"
            placement="bottomLeft"
            content={
              <div style={{ width: 320 }}>
                <p style={{ marginBottom: 8, fontSize: 13, color: 'var(--pms-text-secondary)' }}>
                  选择 IPM 正式项目进行绑定：
                </p>
                <Select
                  showSearch
                  placeholder="搜索 IPM 项目编码或名称"
                  style={{ width: '100%' }}
                  value={ipmSelectValue}
                  onChange={setIpmSelectValue}
                  options={IPM_PROJECTS.map((p) => ({
                    value: p.code,
                    label: `${p.code} - ${p.name}`,
                  }))}
                  optionFilterProp="label"
                />
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Space size={8}>
                    <Button
                      size="small"
                      onClick={() => {
                        setIpmPopoverOpen(false)
                        setIpmSelectValue(undefined)
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      disabled={!ipmSelectValue}
                      onClick={handleIpmBind}
                    >
                      确认绑定
                    </Button>
                  </Space>
                </div>
              </div>
            }
          >
            <Button size="small" icon={<LinkOutlined />}>
              绑定IPM编码
            </Button>
          </Popover>
        )}
      </div>

      {/* IPM 未绑定警告 */}
      {!hasIpm && (
        <Alert
          type="warning"
          showIcon
          message="该项目未绑定 IPM 编码"
          description="仅可创建「年度预算」类型版本。创建「项目概算」或「项目预算」版本前需先绑定 IPM 编码。"
          style={{ marginBottom: 12, borderRadius: 8 }}
        />
      )}

      {/* 工具条：预算类型筛选 + 操作按钮 */}
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
            <span
              style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              预算类型
            </span>
            <Checkbox
              checked={
                selectedBudgetTypes.length > 0 &&
                selectedBudgetTypes.length === ALL_BUDGET_TYPE_VALUES.length
              }
              indeterminate={
                selectedBudgetTypes.length > 0 &&
                selectedBudgetTypes.length < ALL_BUDGET_TYPE_VALUES.length
              }
              onChange={(e) =>
                setSelectedBudgetTypes(e.target.checked ? [...ALL_BUDGET_TYPE_VALUES] : [])
              }
            >
              全选
            </Checkbox>
            <Checkbox.Group
              options={BUDGET_TYPE_OPTIONS}
              value={selectedBudgetTypes}
              onChange={(checkedValues) => setSelectedBudgetTypes(checkedValues as BudgetType[])}
            />
            <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
              共 {filteredVersions.length} 条版本
            </span>
          </Space>
          <Space size={8}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onNewVersion}
              disabled={project.status === 'cancelled'}
            >
              新增版本
            </Button>
            {project.status === 'active' ? (
              <Button danger icon={<StopOutlined />} onClick={() => setStatusModalOpen(true)}>
                取消暂停
              </Button>
            ) : (
              <Button type="primary" onClick={() => setStatusModalOpen(true)}>
                恢复
              </Button>
            )}
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </div>
      </Card>

      {/* 版本列表 */}
      <Table<HrMachineVersion>
        className="pms-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredVersions}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条版本' }}
        rowClassName={(record) => (record.lockState === 'locked' ? 'hr-machine-version-locked' : '')}
        locale={{ emptyText: '当前筛选条件下暂无版本数据' }}
      />

      {/* 项目状态切换确认弹窗 */}
      <Modal
        open={statusModalOpen}
        title={project.status === 'active' ? '取消/暂停项目' : '恢复项目'}
        okText={project.status === 'active' ? '确认取消' : '确认恢复'}
        okButtonProps={{ danger: project.status === 'active' }}
        cancelText="再想想"
        onCancel={() => setStatusModalOpen(false)}
        onOk={handleStatusConfirm}
      >
        <p style={{ margin: 0, color: 'var(--pms-text-primary)' }}>
          {project.status === 'active'
            ? `确认要取消/暂停项目「${project.name}」吗？取消后该项目将不再参与预算统计，可随时恢复。`
            : `确认要恢复项目「${project.name}」吗？恢复后该项目将重新参与预算统计。`}
        </p>
      </Modal>

      <style jsx global>{`
        /* 已锁定版本：整行高亮（品牌色玻璃态） */
        .pms-hr-machine-project-detail .pms-table .ant-table-tbody > tr.hr-machine-version-locked > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-brand-strong);
          font-weight: 500;
        }
        .pms-hr-machine-project-detail .pms-table .ant-table-tbody > tr.hr-machine-version-locked:hover > td {
          background: color-mix(in srgb, var(--pms-brand-surface) 72%, #ffffff) !important;
        }

        /* 行内可编辑单元格：悬停反馈 */
        .pms-hr-machine-project-detail .pms-inline-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
          display: inline-block;
          min-width: 24px;
          text-align: center;
        }
        .pms-hr-machine-project-detail .pms-inline-editable:hover {
          background: var(--pms-brand-surface);
          color: var(--pms-brand-strong);
        }

        /* 行内编辑输入框：紧凑样式 */
        .pms-hr-machine-project-detail .pms-table .ant-inputnumber {
          width: 100%;
        }
        .pms-hr-machine-project-detail .pms-table .ant-picker {
          width: 100%;
        }
        .pms-hr-machine-project-detail .pms-table .ant-select {
          width: 100%;
        }
      `}</style>
    </div>
  )
}
