'use client'

import { useMemo, useState } from 'react'
import { Card, Table, Button, Space, Checkbox, Tag, Modal, message, Popconfirm, Tooltip } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, LockOutlined, DeleteOutlined, ExportOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/stores/hrMachine'
import { BUDGET_TYPES, BUDGET_TYPE_LABELS, formatPersonMonth, MILESTONE_FIELDS } from '@/constants/hrMachine'
import type { HrMachineVersion, BudgetType } from '@/types/hrMachine'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

interface ProjectDetailSpaceProps {
  projectId: string
  onBack: () => void
  onNewVersion: () => void
}

/** 预算类型筛选选项（由常量派生，无需每次渲染重建） */
const BUDGET_TYPE_OPTIONS = BUDGET_TYPES.map((t) => ({ label: t.label, value: t.value }))

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

  // ── 当前项目 ────────────────────────────────────────────────────────
  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  // ── 按预算类型筛选版本，并按 预算类型 → 主版本 → 小版本 排序 ──────────
  const filteredVersions = useMemo<HrMachineVersion[]>(() => {
    if (!project) return []
    const typeOrder = (bt: BudgetType) => BUDGET_TYPES.findIndex((t) => t.value === bt)
    return project.versions
      .filter((v) => selectedBudgetTypes.includes(v.budgetType))
      .sort((a, b) => {
        const byType = typeOrder(a.budgetType) - typeOrder(b.budgetType)
        if (byType !== 0) return byType
        if (a.majorVersion !== b.majorVersion) return a.majorVersion - b.majorVersion
        return a.minorVersion - b.minorVersion
      })
  }, [project, selectedBudgetTypes])

  // ── 版本可锁 / 可编辑判定 ───────────────────────────────────────────
  // 规则（来自飞书文档 3.1）：
  //  1. 已锁定版本：不可编辑、不可再锁。
  //  2. 当某预算类型存在更高主版本的已锁定版本时，旧主版本的草稿（即便未锁定）
  //     也转为只读 —— 对应"V1.0 锁定后 V0.X 不可编辑、锁定按钮消失"。
  //  3. 所有当前主版本的未锁定版本均可执行锁定（"按钮形式"）。
  const { lockableIds, editableIds } = useMemo(() => {
    const lockable = new Set<string>()
    const editable = new Set<string>()
    if (!project) return { lockableIds: lockable, editableIds: editable }

    // 计算每个预算类型下最高已锁定主版本号
    const maxLockedMajorByType = new Map<BudgetType, number>()
    for (const v of project.versions) {
      if (v.lockState === 'locked') {
        const lockedMajor = maxLockedMajorByType.get(v.budgetType) ?? -1
        if (v.majorVersion > lockedMajor) maxLockedMajorByType.set(v.budgetType, v.majorVersion)
      }
    }

    for (const v of project.versions) {
      const maxLockedMajor = maxLockedMajorByType.get(v.budgetType) ?? -1
      // 可编辑/可锁：未锁定，且主版本 >= 该预算类型下最高已锁定主版本
      const isEditable = v.lockState === 'unlocked' && v.majorVersion >= maxLockedMajor
      if (isEditable) editable.add(v.id)
      if (isEditable) lockable.add(v.id)
    }
    return { lockableIds: lockable, editableIds: editable }
  }, [project])

  // ── 项目状态切换弹窗 ────────────────────────────────────────────────
  const [statusModalOpen, setStatusModalOpen] = useState(false)

  // ── 列定义（在早返回之前调用，遵守 Hooks 规则） ─────────────────────
  const columns = useMemo<ColumnsType<HrMachineVersion>>(() => {
    if (!project) return []

    // 里程碑列：由 MILESTONE_FIELDS 动态生成
    const milestoneColumns: ColumnsType<HrMachineVersion> = MILESTONE_FIELDS.map((field) => ({
      title: field.label,
      key: field.key,
      width: 120,
      align: 'center',
      render: (_value: unknown, record: HrMachineVersion) => {
        const value = record.milestones[field.key]
        return value ? (
          <span style={{ color: 'var(--pms-text-primary)' }}>{value}</span>
        ) : (
          <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
        )
      },
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
        render: () => (
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
            {project.projectLevel}
          </span>
        ),
      },
      {
        title: '等级系数',
        key: 'levelCoefficient',
        width: 90,
        align: 'right',
        render: () => project.levelCoefficient,
      },
      {
        title: '人力模型版本',
        key: 'hrModelVersion',
        width: 120,
        render: () => project.hrModelVersion,
      },
      {
        title: '预估投入',
        key: 'estimatedInvestment',
        width: 100,
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
          if (editableIds.has(record.id)) {
            return <Tag color="processing">编辑中</Tag>
          }
          return <Tag color="default">只读</Tag>
        },
      },
      {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 150,
        align: 'center',
        render: (_value: unknown, record: HrMachineVersion) => (
          <Space size={4}>
            {lockableIds.has(record.id) && project.status === 'active' ? (
              <Tooltip title="锁定后版本号升为正式版，该预算类型下的历史草稿版本将变为只读">
                <Button
                  type="link"
                  size="small"
                  icon={<LockOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    lockVersion(project.id, record.id)
                    message.success('版本已锁定，已升为正式版')
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
                type="link"
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
  }, [project, lockableIds, editableIds, lockVersion, deleteVersion, deleteProject, onBack])

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
      { key: 'projectLevel', title: '项目等级', formatter: () => project.projectLevel },
      { key: 'levelCoefficient', title: '等级系数', formatter: () => project.levelCoefficient },
      { key: 'hrModelVersion', title: '人力模型版本', formatter: () => project.hrModelVersion },
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

  return (
    <div className="pms-hr-machine-project-detail">
      {/* 顶部：返回 + 项目标题 + 状态 */}
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
      </div>

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
        /* 已锁定版本：整行高亮（紫科技玻璃态品牌色） */
        .pms-hr-machine-project-detail .pms-table .ant-table-tbody > tr.hr-machine-version-locked > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-brand-strong);
          font-weight: 500;
        }
        .pms-hr-machine-project-detail .pms-table .ant-table-tbody > tr.hr-machine-version-locked:hover > td {
          background: color-mix(in srgb, var(--pms-brand-surface) 72%, #ffffff) !important;
        }
      `}</style>
    </div>
  )
}
