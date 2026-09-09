'use client'

import { getHrVersionSeed, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { resolveHrFormalSource } from '@/lib/hrFormalProjectSource'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'

import { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Select,
  Table,
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
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import {
  TECH_BUDGET_TYPES,
  TECH_BUDGET_TYPE_LABELS,
  TECH_IPM_REQUIRED_TYPES,
  TECH_IPM_REQUIRED_TIP,
  TECH_PHASE_INVESTMENT_FIELDS,
  formatPersonMonth,
} from '@/constants/hrTechnical'
import { exportSheet } from '@/utils/exportExcel'
import type { BudgetType, TechDepartmentInvestment, TechPhaseKey } from '@/types/hrTechnical'

interface NewVersionModalProps {
  open: boolean
  projectId: string
  onCancel: () => void
}

export default function NewVersionModal({ open, projectId, onCancel }: NewVersionModalProps) {
  const { message } = App.useApp()
  const { primaryOptions, getSecondaryOptions, isValidPair } = useHrDepartmentOptions()
  const { projects, addVersion } = useHrTechnicalStore()
  const [localProjectId, setLocalProjectId] = useState(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [editData, setEditData] = useState<TechDepartmentInvestment[]>([])
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

  useEffect(() => {
    if (!open) return
    const selected = useHrTechnicalStore.getState().projects.find(p => p.id === localProjectId)
    const seed = selected && budgetType ? getHrVersionSeed(selected.versions, budgetType) : undefined
    setEditData((seed?.departmentInvestments ?? []).map(row => ({ ...row })))
  }, [open, localProjectId, budgetType])

  // ── 合计 ────────────────────────────────────────────────────────────
  const editTotal = useMemo(
    () =>
      editData.reduce(
        (sum, d) =>
          sum + TECH_PHASE_INVESTMENT_FIELDS.reduce(
            (acc, f) => acc + (Number(d[f.key]) || 0), 0,
          ),
        0,
      ),
    [editData],
  )

  // ── 行操作 ──────────────────────────────────────────────────────────
  const updateRow = (id: string, field: keyof TechDepartmentInvestment, value: string | number) => {
    setEditData(prev =>
      prev.map(d => {
        if (d.id !== id) return d
        const updated = { ...d, [field]: value, ...(field === 'primaryDepartment' && d.primaryDepartment !== value ? { secondaryDepartment: '' } : {}) }
        const phaseKeys = TECH_PHASE_INVESTMENT_FIELDS.map(f => f.key)
        if (phaseKeys.includes(field as TechPhaseKey)) {
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
    const newRow: TechDepartmentInvestment = {
      id: `di-new-${Date.now()}`,
      primaryDepartment: '',
      secondaryDepartment: '',
      estimatedInvestment: 0,
      planningPhase: 0,
      conceptPhase: 0,
      planPhase: 0,
      developmentPhase: 0,
      migrationPhase: 0,
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
    for (const f of TECH_PHASE_INVESTMENT_FIELDS) {
      templateRow[f.key] = 0
    }
    exportSheet(
      [templateRow],
      [
        { key: 'primaryDepartment', title: '一级部门' },
        { key: 'secondaryDepartment', title: '二级部门' },
        ...TECH_PHASE_INVESTMENT_FIELDS.map(f => ({ key: f.key, title: f.label })),
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
      const parsed: TechDepartmentInvestment[] = rows
        .slice(1)
        .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map((row, idx) => {
          const r = row as unknown[]
          const phaseValues: Record<string, number> = {}
          TECH_PHASE_INVESTMENT_FIELDS.forEach((f, i) => {
            phaseValues[f.key] = r[2 + i] != null ? Number(r[2 + i]) || 0 : 0
          })
          const rowTotal = TECH_PHASE_INVESTMENT_FIELDS.reduce(
            (sum, f) => sum + (phaseValues[f.key] || 0), 0,
          )
          return {
            id: `di-import-${Date.now()}-${idx}`,
            primaryDepartment: r[0] != null ? String(r[0]).trim() : '',
            secondaryDepartment: r[1] != null ? String(r[1]).trim() : '',
            estimatedInvestment: Math.round(rowTotal * 10) / 10,
            planningPhase: phaseValues.planningPhase ?? 0,
            conceptPhase: phaseValues.conceptPhase ?? 0,
            planPhase: phaseValues.planPhase ?? 0,
            developmentPhase: phaseValues.developmentPhase ?? 0,
            migrationPhase: phaseValues.migrationPhase ?? 0,
          } as TechDepartmentInvestment
        })
      if (parsed.length === 0) {
        message.warning('未解析到有效数据，请检查模板格式')
        return false
      }
      if (parsed.some(row => !isValidPair(row.primaryDepartment, row.secondaryDepartment))) {
        message.error('导入数据包含无效的一级部门或二级部门，请按部门下拉选项填写')
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
  const columns: ColumnsType<TechDepartmentInvestment> = useMemo(() => [
    {
      title: '一级部门',
      key: 'primaryDepartment',
      width: 140,
      fixed: 'left' as const,
      render: (_value: unknown, record: TechDepartmentInvestment) => (
        <Select
          showSearch
          aria-label="一级部门"
          value={record.primaryDepartment || undefined}
          placeholder="请选择一级部门"
          style={{ width: '100%' }}
          options={primaryOptions}
          optionFilterProp="label"
          onChange={value => updateRow(record.id, 'primaryDepartment', value)}
        />
      ),
    },
    {
      title: '二级部门',
      key: 'secondaryDepartment',
      width: 140,
      fixed: 'left' as const,
      render: (_value: unknown, record: TechDepartmentInvestment) => (
        <Select
          showSearch
          aria-label="二级部门"
          value={record.secondaryDepartment || undefined}
          placeholder="请选择二级部门"
          style={{ width: '100%' }}
          options={getSecondaryOptions(record.primaryDepartment)}
          disabled={!record.primaryDepartment}
          onChange={value => updateRow(record.id, 'secondaryDepartment', value)}
        />
      ),
    },
    ...TECH_PHASE_INVESTMENT_FIELDS.map(f => ({
      title: f.label,
      key: f.key,
      width: 130,
      align: 'right' as const,
      render: (_value: unknown, record: TechDepartmentInvestment) => (
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
      render: (_value: unknown, record: TechDepartmentInvestment) => (
        <span style={{ fontWeight: 600 }}>
          {formatPersonMonth(Number(record.estimatedInvestment) || 0)}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 80,
      align: 'center' as const,
      render: (_value: unknown, record: TechDepartmentInvestment) => (
        <Button type="text" aria-label="删除" title="删除"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => deleteRow(record.id)}
        />
      ),
    },
  ], [primaryOptions, getSecondaryOptions])

  // ── 提交 ────────────────────────────────────────────────────────────
  const handleOk = async () => {
    if (!project) { message.warning('请选择项目'); return }
    if (!hasIpm && TECH_IPM_REQUIRED_TYPES.includes(budgetType)) {
      message.warning(TECH_IPM_REQUIRED_TIP)
      return
    }
    if (editData.length === 0) {
      message.warning('请至少添加一条部门预估投入数据')
      return
    }
    const hasEmpty = editData.some(d => !isValidPair(d.primaryDepartment, d.secondaryDepartment))
    if (hasEmpty) {
      message.warning('请选择有效的一级部门和对应二级部门')
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

  const budgetOptions = TECH_BUDGET_TYPES.map(bt => {
    const restricted = !hasIpm && TECH_IPM_REQUIRED_TYPES.includes(bt.value)
    return {
      value: bt.value,
      label: restricted ? (
        <Tooltip title={TECH_IPM_REQUIRED_TIP}>
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
            <span style={{ color: 'var(--pms-text-tertiary)' }}>TDT项目：</span>
            <Select
              showSearch
              aria-label="选择项目"
              placeholder="请选择项目"
              value={localProjectId || undefined}
              options={projects.map(p => ({ value: p.id, label: p.tdtName }))}
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
        {hasIpm && budgetType !== 'annual' && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={resolveHrFormalSource('technical', project?.ipmProjectCode ?? null).project ? '里程碑取自主市场／主类型最新已发布一级计划；尚无已发布计划时等待计划发布。' : '当前正式项目编码未找到对应项目，请在项目列表重新绑定。'} />}

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
        <Table<TechDepartmentInvestment>
          className="pms-table pms-hr-investment-table"
          rowKey="id"
          columns={columns}
          dataSource={editData}
          pagination={false}
          size="small"
          tableLayout="fixed"
          scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0), y: 320 }}
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
            <li>年度预算最新版本采用手动里程碑；其他预算类型绑定后随正式项目最新已发布一级计划更新</li>
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
