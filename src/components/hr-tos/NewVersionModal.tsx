'use client'

import { nextHrMinorVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'

import { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Select,
  Table,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  App,
  Tooltip,
  Tag,
  Form,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { useHrTosStore } from '@/stores/hrTos'
import {
  TOS_BUDGET_TYPES,
  TOS_BUDGET_TYPE_LABELS,
  TOS_IPM_REQUIRED_TYPES,
  TOS_IPM_REQUIRED_TIP,
  TOS_PHASE_INVESTMENT_FIELDS,
  formatPersonMonth,
} from '@/constants/hrTos'
import { exportSheet } from '@/utils/exportExcel'
import type { BudgetType, TosDepartmentInvestment, TosPhaseKey } from '@/types/hrTos'

interface NewVersionModalProps {
  open: boolean
  projectId: string
  onCancel: () => void
}

export default function NewVersionModal({ open, projectId, onCancel }: NewVersionModalProps) {
  const { message } = App.useApp()
  const { projects, addVersion } = useHrTosStore()
  const [localProjectId, setLocalProjectId] = useState(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [editData, setEditData] = useState<TosDepartmentInvestment[]>([])
  const [submitting, setSubmitting] = useState(false)

  const project = useMemo(
    () => projects.find(p => p.id === localProjectId),
    [projects, localProjectId],
  )

  const hasIpm = useMemo(
    () => Boolean(project?.ipmProjectCode),
    [project],
  )

  useEffect(() => {
    if (open) {
      setLocalProjectId(projectId || '')
      setBudgetType('annual')
      setEditData([])
    }
  }, [open, projectId])

  // ── 合计 ────────────────────────────────────────────────────────────
  const editTotal = useMemo(
    () =>
      editData.reduce(
        (sum, d) =>
          sum + TOS_PHASE_INVESTMENT_FIELDS.reduce(
            (acc, f) => acc + (Number(d[f.key]) || 0), 0,
          ),
        0,
      ),
    [editData],
  )

  // ── 行操作 ──────────────────────────────────────────────────────────
  const updateRow = (id: string, field: keyof TosDepartmentInvestment, value: string | number) => {
    setEditData(prev =>
      prev.map(d => {
        if (d.id !== id) return d
        const updated = { ...d, [field]: value }
        const phaseKeys = TOS_PHASE_INVESTMENT_FIELDS.map(f => f.key)
        if (phaseKeys.includes(field as TosPhaseKey)) {
          const rowTotal = phaseKeys.reduce(
            (sum, key) => sum + (Number(updated[key]) || 0), 0,
          )
          updated.estimatedInvestment = Math.round(rowTotal * 10) / 10
        }
        return updated
      }),
    )
  }

  const addRow = () => {
    const newRow: TosDepartmentInvestment = {
      id: `di-new-${Date.now()}`,
      primaryDepartment: '',
      secondaryDepartment: '',
      estimatedInvestment: 0,
      planningPhase: 0,
      conceptPhase: 0,
      planningPhase2: 0,
      developmentValidationPhase: 0,
      marketIterationPhase: 0,
      maintenancePhase: 0,
    }
    setEditData(prev => [...prev, newRow])
  }

  const deleteRow = (id: string) => {
    setEditData(prev => prev.filter(d => d.id !== id))
  }

  // ── 下载导入模板 ────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const templateRow: Record<string, string | number> = {
      primaryDepartment: '',
      secondaryDepartment: '',
    }
    for (const f of TOS_PHASE_INVESTMENT_FIELDS) {
      templateRow[f.key] = 0
    }
    exportSheet(
      [templateRow],
      [
        { key: 'primaryDepartment', title: '一级部门' },
        { key: 'secondaryDepartment', title: '二级部门' },
        ...TOS_PHASE_INVESTMENT_FIELDS.map(f => ({ key: f.key, title: f.label })),
      ],
      '部门预估投入模板.xlsx',
      '部门预估投入',
    )
  }

  // ── 导入 Excel ──────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        message.error('文件中没有工作表')
        return false
      }
      const sheet = workbook.Sheets[firstSheetName]
      const rows: unknown[][] = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
      const parsed: TosDepartmentInvestment[] = rows
        .slice(1)
        .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map((row, idx) => {
          const r = row as unknown[]
          const phaseValues: Record<string, number> = {}
          TOS_PHASE_INVESTMENT_FIELDS.forEach((f, i) => {
            phaseValues[f.key] = r[2 + i] != null ? Number(r[2 + i]) || 0 : 0
          })
          const rowTotal = TOS_PHASE_INVESTMENT_FIELDS.reduce(
            (sum, f) => sum + (phaseValues[f.key] || 0), 0,
          )
          return {
            id: `di-import-${Date.now()}-${idx}`,
            primaryDepartment: r[0] != null ? String(r[0]).trim() : '',
            secondaryDepartment: r[1] != null ? String(r[1]).trim() : '',
            estimatedInvestment: Math.round(rowTotal * 10) / 10,
            planningPhase: phaseValues.planningPhase ?? 0,
            conceptPhase: phaseValues.conceptPhase ?? 0,
            planningPhase2: phaseValues.planningPhase2 ?? 0,
            developmentValidationPhase: phaseValues.developmentValidationPhase ?? 0,
            marketIterationPhase: phaseValues.marketIterationPhase ?? 0,
            maintenancePhase: phaseValues.maintenancePhase ?? 0,
          } as TosDepartmentInvestment
        })
      if (parsed.length === 0) {
        message.warning('未解析到有效数据，请检查模板格式')
        return false
      }
      setEditData(parsed)
      message.success(`已导入 ${parsed.length} 条部门数据`)
    } catch (err) {
      console.error('[import] failed', err)
      message.error('文件解析失败，请检查模板格式')
    }
    return false
  }

  // ── 列定义 ──────────────────────────────────────────────────────────
  const columns: ColumnsType<TosDepartmentInvestment> = useMemo(() => [
    {
      title: '一级部门',
      key: 'primaryDepartment',
      width: 140,
      fixed: 'left' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        <Input
          value={record.primaryDepartment}
          placeholder="请输入一级部门"
          onChange={e => updateRow(record.id, 'primaryDepartment', e.target.value)}
        />
      ),
    },
    {
      title: '二级部门',
      key: 'secondaryDepartment',
      width: 140,
      fixed: 'left' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        <Input
          value={record.secondaryDepartment}
          placeholder="请输入二级部门"
          onChange={e => updateRow(record.id, 'secondaryDepartment', e.target.value)}
        />
      ),
    },
    ...TOS_PHASE_INVESTMENT_FIELDS.map(f => ({
      title: f.label,
      key: f.key,
      width: 130,
      align: 'right' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        <InputNumber
          value={record[f.key] as number}
          min={0}
          step={0.1}
          precision={1}
          style={{ width: '100%' }}
          onChange={v => updateRow(record.id, f.key, v ?? 0)}
        />
      ),
    })),
    {
      title: '预估投入合计',
      key: 'estimatedInvestment',
      width: 120,
      align: 'right' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        <span style={{ fontWeight: 600 }}>
          {formatPersonMonth(Number(record.estimatedInvestment) || 0)}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => deleteRow(record.id)}
        >
          删除
        </Button>
      ),
    },
  ], [])

  // ── 提交 ────────────────────────────────────────────────────────────
  const handleOk = async () => {
    if (!project) { message.warning('请选择项目'); return }
    if (!hasIpm && TOS_IPM_REQUIRED_TYPES.includes(budgetType)) {
      message.warning(TOS_IPM_REQUIRED_TIP)
      return
    }
    if (editData.length === 0) {
      message.warning('请至少添加一条部门预估投入数据')
      return
    }
    // 校验是否有空部门名称
    const hasEmpty = editData.some(d => !d.primaryDepartment || !d.secondaryDepartment)
    if (hasEmpty) {
      message.warning('请填写所有部门名称')
      return
    }
    try {
      setSubmitting(true)
      addVersion(project.id, { budgetType, departmentInvestments: editData })
      message.success('版本创建成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  const budgetOptions = TOS_BUDGET_TYPES.map(bt => {
    const restricted = !hasIpm && TOS_IPM_REQUIRED_TYPES.includes(bt.value)
    return {
      value: bt.value,
      label: restricted ? (
        <Tooltip title={TOS_IPM_REQUIRED_TIP}>
          <span style={{ color: 'var(--pms-text-tertiary)' }}>{bt.label}</span>
        </Tooltip>
      ) : (
        bt.label
      ),
      disabled: restricted,
    }
  })

  return (
    <Modal
      className="pms-modal"
      title="新增版本"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !project }}
      okText="创建"
      cancelText="取消"
      width={1280}
    >
      <div style={{ marginTop: 16 }}>
        {/* 项目信息 */}
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--pms-text-tertiary)' }}>项目：</span>
            <Select
              showSearch
              aria-label="选择项目"
              placeholder="请选择项目"
              value={localProjectId || undefined}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              optionFilterProp="label"
              style={{ minWidth: 280 }}
              onChange={value => { setLocalProjectId(value); setBudgetType('annual'); setEditData([]) }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--pms-text-tertiary)' }}>IPM：</span>
            {hasIpm ? (
              <span style={{ color: 'var(--pms-text-secondary)' }}>
                <Tag color="green" style={{ marginRight: 6 }}>已绑定</Tag>
                {project?.ipmProjectCode}
                {project?.ipmProjectName ? ` · ${project.ipmProjectName}` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--pms-text-tertiary)' }}>
                <Tag color="default" style={{ marginRight: 6 }}>未绑定</Tag>
                仅可创建年度预算版本
              </span>
            )}
          </div>
        </div>

        {project && <div style={{ marginBottom: 12 }}>将创建版本：<strong>V0.{nextHrMinorVersion(project.versions, budgetType)}</strong></div>}
        {hasIpm && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={resolveHrFormalSource('tos', project?.ipmProjectCode ?? null).project ? '里程碑取自主市场／主类型最新已发布一级计划；尚无已发布计划时等待计划发布。' : '当前正式项目编码未找到对应项目，请在项目列表重新绑定。'} />}

        {/* 表单字段 */}
        <Form layout="vertical">
          <Form.Item label="预算类型" required>
            <Select
              value={budgetType}
              onChange={v => setBudgetType(v)}
              style={{ width: '100%' }}
              options={budgetOptions}
            />
          </Form.Item>
        </Form>

        {/* 合计提示 */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`各阶段预估投入合计：${formatPersonMonth(editTotal)}`}
        />

        {/* 操作按钮 */}
        <div style={{ marginBottom: 8 }}>
          <Space size="small">
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addRow}>
              添加部门
            </Button>
            <Button size="small" type="dashed" icon={<DownloadOutlined />} onClick={downloadTemplate}>
              下载模板
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleImport}
            >
              <Button size="small" type="dashed" icon={<UploadOutlined />}>
                导入
              </Button>
            </Upload>
          </Space>
        </div>

        {/* 部门预估投入表格 */}
        <Table<TosDepartmentInvestment>
          className="pms-table"
          rowKey="id"
          columns={columns}
          dataSource={editData}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content', y: 320 }}
          locale={{
            emptyText: '暂无部门预估投入数据，请点击「添加部门」或「导入」',
          }}
        />

        {/* 合计汇总条 */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--pms-text-secondary)' }}>
              编辑各阶段预估投入，合计将自动更新
            </span>
            <span>
              <span style={{ color: 'var(--pms-text-tertiary)' }}>合计：</span>
              <strong style={{ color: 'var(--pms-brand-strong)', fontSize: 14 }}>
                {formatPersonMonth(editTotal)}
              </strong>
            </span>
          </div>
        </div>

        {/* 版本规则说明 */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'var(--pms-brand-surface)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--pms-text-tertiary)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: 'var(--pms-text-secondary)' }}>
            版本规则：
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, lineHeight: '1.8' }}>
            <li>同一项目、同一预算类型从 V0.1 开始递增</li>
            <li>仅最新版本可编辑，历史版本保留原有日期和投入数据</li>
            <li>所有版本均可修改批次</li>
            <li>绑定正式项目后，最新版本里程碑随主市场／主类型最新已发布一级计划更新</li>
            <li>预估投入合计由各部门各阶段投入自动汇总</li>
          </ul>
        </div>
      </div>

      <style jsx global>{`
        .pms-modal .pms-table {
          font-variant-numeric: tabular-nums;
        }
        .pms-modal .pms-table .ant-inputnumber {
          width: 100%;
        }
      `}</style>
    </Modal>
  )
}
