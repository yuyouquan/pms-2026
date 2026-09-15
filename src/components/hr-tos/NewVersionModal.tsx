'use client'

import { HrVersionModalTitle } from '@/components/project-resources/HrVersionModalTitle'

import NonLaborInvestmentSection, { useNonLaborDraft } from '@/components/project-resources/NonLaborInvestmentSection'

import { canAccessHrProject, getHrAllowedBudgetTypes } from '@/lib/hrProjectRegistry'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { canCreateHrVersion, getHrVersionSeed } from '@/lib/hrVersionRules'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'

import { HrVersionMilestoneRow, useHrVersionMilestones } from '@/components/project-resources/HrVersionMilestones'
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
import { useHrTosStore } from '@/hooks/useHrResourceStores'
import {
  TOS_BUDGET_TYPES,
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
  const scopeId = useHrResourceScope()
  const { primaryOptions, getSecondaryOptions, isValidPair } = useHrDepartmentOptions()
  const { projects, addVersion } = useHrTosStore()
  const [localProjectId, setLocalProjectId] = useState(projectId)
  const [budgetType, setBudgetType] = useState<BudgetType>('annual')
  const [editData, setEditData] = useState<TosDepartmentInvestment[]>([])
  const [submitting, setSubmitting] = useState(false)

  const project = useMemo(
    () => projects.find(p => p.id === localProjectId),
    [projects, localProjectId],
  )

  const nonLabor = useNonLaborDraft(open, localProjectId + ':' + budgetType, project && budgetType ? getHrVersionSeed(project.versions, budgetType)?.nonLaborInvestment : undefined)

  const milestoneForm = useHrVersionMilestones('tos', project, budgetType, open)


  useEffect(() => {
    if (open) {
      setLocalProjectId(scopeId ? projects.find(p => p.pmsProjectId === scopeId)?.id ?? '' : projectId || '')
      setBudgetType(getHrAllowedBudgetTypes(projects.find(p => scopeId ? p.pmsProjectId === scopeId : p.id === projectId))[0] ?? 'annual')
      setEditData([])
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    const selected = useHrTosStore.getState().projects.find(p => p.id === localProjectId)
    const seed = selected && budgetType ? getHrVersionSeed(selected.versions, budgetType) : undefined
    setEditData((seed?.departmentInvestments ?? []).map(row => ({ ...row })))
  }, [open, localProjectId, budgetType])

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
        const updated = { ...d, [field]: value, ...(field === 'primaryDepartment' && d.primaryDepartment !== value ? { secondaryDepartment: '' } : {}) }
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
  const columns: ColumnsType<TosDepartmentInvestment> = useMemo(() => [
    {
      title: '一级部门',
      key: 'primaryDepartment',
      width: 140,
      fixed: 'left' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
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
      render: (_value: unknown, record: TosDepartmentInvestment) => (
        !record.primaryDepartment ? <HrReadonlyField label="二级部门" placeholder="请先选择一级部门" reason="选择一级部门后可编辑" /> : <Select
          showSearch
          aria-label="二级部门"
          value={record.secondaryDepartment || undefined}
          placeholder="请选择二级部门"
          style={{ width: '100%' }}
          options={getSecondaryOptions(record.primaryDepartment)}
          onChange={value => updateRow(record.id, 'secondaryDepartment', value)}
        />
      ),
    },
    ...TOS_PHASE_INVESTMENT_FIELDS.map(f => ({
      title: f.label,
      key: f.key,
      width: 130,
      align: 'center' as const,
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
      align: 'center' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
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
      align: 'left' as const,
      render: (_value: unknown, record: TosDepartmentInvestment) => (
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
    if (project?.status === 'cancelled') { message.warning('已取消的项目不支持新建版本'); return }
    if (!project) { message.warning('请选择项目'); return }
    if (!canCreateHrVersion(project, budgetType)) { message.warning('当前项目无新建版本权限'); return }
    if (editData.length === 0) {
      message.warning('请至少添加一条部门预估投入数据')
      return
    }
    // 校验是否有空部门名称
    const hasEmpty = editData.some(d => !isValidPair(d.primaryDepartment, d.secondaryDepartment))
    if (hasEmpty) {
      message.warning('请选择有效的一级部门和对应二级部门')
      return
    }
    try {
      setSubmitting(true)
      addVersion(project.id, { budgetType, nonLaborInvestment: nonLabor.value, departmentInvestments: editData, milestones: milestoneForm.values })
      message.success('版本创建成功')
      onCancel()
    } catch (error) {
      message.warning(error instanceof Error ? error.message : '版本创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const budgetOptions = TOS_BUDGET_TYPES.filter(type => getHrAllowedBudgetTypes(project).includes(type.value))

  return (
    <Modal
      className="pms-modal pms-hr-version-modal"
      title={<HrVersionModalTitle title="新增版本" projectName={project?.name} />}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !canCreateHrVersion(project, budgetType) }}
      okText="创建"
      cancelText="取消"
      width={1560}
    >
      <div>
        {/* 表单字段 */}
        <Form layout="vertical" className="pms-hr-version-form pms-hr-version-form--tos">
          {!scopeId && <Form.Item label="项目" required>
            <Select
                showSearch
                aria-label="选择项目"
                placeholder="请选择项目"
                value={localProjectId || undefined}
                options={projects.filter(p => canAccessHrProject(p, true) && getHrAllowedBudgetTypes(p).length > 0).map(p => ({ disabled: p.status !== 'active', value: p.id, label: p.name }))}
                optionFilterProp="label"
                onChange={value => { setLocalProjectId(value); setBudgetType(getHrAllowedBudgetTypes(projects.find(p => p.id === value))[0] ?? 'annual'); setEditData([]) }}
              />
          </Form.Item>}
          <Form.Item label="预算类型" required>
            <Select
              value={budgetType}
              onChange={v => setBudgetType(v)}
              style={{ width: '100%' }}
              options={budgetOptions}
            />
          </Form.Item>
        </Form>
        <Form layout="vertical"><HrVersionMilestoneRow category="tos" {...milestoneForm} /></Form>

        {/* 合计提示 */}
        <h3 className="pms-hr-investment-section-title">各部门人力投入</h3>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          title={`预估人力投入合计：${formatPersonMonth(editTotal)} 人月。`}
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

        <NonLaborInvestmentSection {...nonLabor} />
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
