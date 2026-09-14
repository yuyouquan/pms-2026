'use client'

import { canAccessHrProject, getHrAllowedBudgetTypes, resolveHrNewVersionProjectId } from '@/lib/hrProjectRegistry'
import { HrReadonlyField } from '@/components/project-resources/HrReadonlyField'
import { useHrResourceScope } from '@/components/project-resources/HrResourceScope'
import { canCreateHrVersion, getHrVersionSeed } from '@/lib/hrVersionRules'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'

import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Table,
  InputNumber,
  Button,
  Space,
  Alert,
  App,
  Upload,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useHrCapabilityStore } from '@/hooks/useHrResourceStores'
import {
  CAPABILITY_BUDGET_TYPES,
  CAPABILITY_BUDGET_TYPE_LABELS,
  CAPABILITY_IPM_REQUIRED_TYPES,
  CAPABILITY_IPM_REQUIRED_TIP,
  formatPersonMonth,
} from '@/constants/hrCapability'
import type { CapabilityDepartmentInvestment, BudgetType } from '@/types/hrCapability'
import { exportSheet } from '@/utils/exportExcel'

interface NewVersionModalProps {
  open: boolean
  onCancel: () => void
}

export default function NewVersionModal({ open, onCancel }: NewVersionModalProps) {
  const { message } = App.useApp()
  const scopeId = useHrResourceScope()
  const { primaryOptions, getSecondaryOptions, isValidPair } = useHrDepartmentOptions()
  const [form] = Form.useForm()
  const projects = useHrCapabilityStore((s) => s.projects)
  const selectedProjectId = useHrCapabilityStore((s) => s.selectedProjectId)
  const addVersion = useHrCapabilityStore((s) => s.addVersion)
  const setShowNewVersionModal = useHrCapabilityStore((s) => s.setShowNewVersionModal)

  const [localProjectId, setLocalProjectId] = useState(resolveHrNewVersionProjectId(projects, selectedProjectId, scopeId))
  const [editData, setEditData] = useState<CapabilityDepartmentInvestment[]>([])
  const [budgetType, setBudgetType] = useState<BudgetType | null>(null)
  const [startTime, setStartTime] = useState<dayjs.Dayjs | null>(null)
  const [endTime, setEndTime] = useState<dayjs.Dayjs | null>(null)

  const project = useMemo(
    () => projects.find((p) => p.id === localProjectId) ?? null,
    [projects, localProjectId],
  )

  const canCreateVersion = canCreateHrVersion(project, budgetType)

  useEffect(() => {
    if (open) {
      setLocalProjectId(resolveHrNewVersionProjectId(projects, selectedProjectId, scopeId))
      setBudgetType(getHrAllowedBudgetTypes(projects.find(p => scopeId ? p.pmsProjectId === scopeId : p.id === selectedProjectId))[0] ?? 'annual')
      setStartTime(null)
      setEndTime(null)
      setEditData([])
    }
  }, [open, selectedProjectId, scopeId])

  useEffect(() => {
    if (!open) return
    const selected = useHrCapabilityStore.getState().projects.find(p => p.id === localProjectId)
    const seed = selected && budgetType ? getHrVersionSeed(selected.versions, budgetType) : undefined
    setEditData((seed?.departmentInvestments ?? []).map(row => ({ ...row })))
    setStartTime(seed?.projectStartTime ? dayjs(seed.projectStartTime) : null)
    setEndTime(seed?.projectEndTime ? dayjs(seed.projectEndTime) : null)
  }, [open, localProjectId, budgetType])

  const editTotal = useMemo(
    () => editData.reduce((sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0),
    [editData],
  )

  const resetState = () => {
    setEditData([])
    setBudgetType(null)
    setStartTime(null)
    setEndTime(null)
    form.resetFields()
  }

  const updateRow = (id: string, field: keyof CapabilityDepartmentInvestment, value: string | number) => {
    setEditData((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value, ...(field === 'primaryDepartment' && d.primaryDepartment !== value ? { secondaryDepartment: '' } : {}) } : d)),
    )
  }

  const addRow = () => {
    const newRow: CapabilityDepartmentInvestment = {
      id: `cap-di-new-${Date.now()}`,
      primaryDepartment: '',
      secondaryDepartment: '',
      estimatedInvestment: 0,
    }
    setEditData((prev) => [...prev, newRow])
  }

  const deleteRow = (id: string) => {
    setEditData((prev) => prev.filter((d) => d.id !== id))
  }

  const downloadTemplate = () => {
    const templateRow = {
      primaryDepartment: '',
      secondaryDepartment: '',
      estimatedInvestment: 0,
    }
    exportSheet(
      [templateRow],
      [
        { key: 'primaryDepartment', title: '一级部门' },
        { key: 'secondaryDepartment', title: '二级部门' },
        { key: 'estimatedInvestment', title: '预估投入' },
      ],
      '能力建设项目部门预估投入模板.xlsx',
      '部门预估投入',
    )
  }

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
      const parsed: CapabilityDepartmentInvestment[] = rows
        .slice(1)
        .filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && cell !== ''))
        .map((row, idx) => {
          const r = row as unknown[]
          return {
            id: `cap-di-import-${Date.now()}-${idx}`,
            primaryDepartment: r[0] != null ? String(r[0]).trim() : '',
            secondaryDepartment: r[1] != null ? String(r[1]).trim() : '',
            estimatedInvestment: r[2] != null ? Number(r[2]) || 0 : 0,
          }
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

  const handleOk = async () => {
    if (project?.status === 'cancelled') { message.warning('已取消的项目不支持新建版本'); return }
    if (!project) {
      message.error('请先选择项目')
      return
    }
    if (!budgetType) {
      message.error('请选择预算类型')
      return
    }
    if (!startTime || !endTime) {
      message.error('请选择项目起止时间')
      return
    }
    if (endTime && startTime && endTime.isBefore(startTime)) {
      message.error('项目结束时间不能早于开始时间')
      return
    }
    if (editData.length === 0) {
      message.error('请至少添加一条部门预估投入')
      return
    }
    if (editData.some(row => !isValidPair(row.primaryDepartment, row.secondaryDepartment))) {
      message.error('请选择有效的一级部门和对应二级部门')
      return
    }
    if (!canCreateVersion) {
      message.error('当前项目无新建版本权限')
      return
    }

    addVersion(project.id, {
      budgetType,
      projectStartTime: startTime?.format('YYYY-MM-DD') ?? '',
      projectEndTime: endTime?.format('YYYY-MM-DD') ?? '',
      departmentInvestments: editData,
    })
    message.success('版本创建成功')
    onCancel()
    resetState()
    setShowNewVersionModal(false)
  }

  const handleCancel = () => {
    resetState()
    setShowNewVersionModal(false)
    onCancel()
  }

  const columns: ColumnsType<CapabilityDepartmentInvestment> = useMemo(() => [
    {
      title: '一级部门',
      key: 'primaryDepartment',
      width: 160,
      fixed: 'left' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
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
      width: 160,
      fixed: 'left' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
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
    {
      title: '预估投入（人月）',
      key: 'estimatedInvestment',
      width: 150,
      align: 'right' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
        <InputNumber
          value={record.estimatedInvestment}
          min={0}
          step={0.1}
          precision={1}
          style={{ width: '100%' }}
          onChange={(v) => updateRow(record.id, 'estimatedInvestment', v ?? 0)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 80,
      align: 'center' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
        <Button type="text" aria-label="删除" title="删除"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => deleteRow(record.id)}
        />
      ),
    },
  ], [primaryOptions, getSecondaryOptions])


  return (
    <Modal
      className="pms-modal pms-hr-version-modal"
      title="新建版本"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="创建"
      cancelText="取消"
      width={900}
      okButtonProps={{ disabled: !canCreateHrVersion(project, budgetType) }}
    >
      <div>
        {/* 表单区 */}
        <Form form={form} layout="vertical">
          <div className="pms-hr-version-form">
          {!scopeId && <Form.Item label="项目" required>
            <Select
                showSearch
                aria-label="选择项目"
                placeholder="请选择项目"
                value={localProjectId || undefined}
                options={projects.filter(p => canAccessHrProject(p, true) && getHrAllowedBudgetTypes(p).length > 0).map(p => ({ disabled: p.status !== 'active', value: p.id, label: p.name }))}
                optionFilterProp="label"
                onChange={value => { setLocalProjectId(value); setBudgetType(getHrAllowedBudgetTypes(projects.find(p => p.id === value))[0] ?? 'annual'); setStartTime(null); setEndTime(null); setEditData([]) }}
              />
          </Form.Item>}
            <Form.Item label="预算类型" required>
              <Select
                style={{ width: '100%' }}
                placeholder="选择预算类型"
                value={budgetType}
                onChange={(v) => setBudgetType(v)}
                options={CAPABILITY_BUDGET_TYPES.filter(type => getHrAllowedBudgetTypes(project).includes(type.value)).map((t) => ({
                  label: t.label,
                  value: t.value,
                }))}
              />
            </Form.Item>
            <Form.Item label="项目开始时间" required>
              <DatePicker
                style={{ width: '100%' }}
                placeholder="选择开始时间"
                value={startTime}
                onChange={setStartTime}
              />
            </Form.Item>
            <Form.Item label="项目结束时间" required>
              <DatePicker
                style={{ width: '100%' }}
                placeholder="选择结束时间"
                value={endTime}
                onChange={setEndTime}
              />
            </Form.Item>

          </div>
        </Form>

        <Alert type="info" showIcon style={{ marginBottom: 12 }} title={`预估人力投入合计：${formatPersonMonth(editTotal)} 人月。`} />

        {/* 操作按钮 */}
        <div style={{ marginBottom: 8 }}>
          <Space size="small">
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addRow}>
              添加部门
            </Button>
            <Button size="small" type="dashed" icon={<DownloadOutlined />} onClick={downloadTemplate}>
              下载模板
            </Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport}>
              <Button size="small" type="dashed" icon={<UploadOutlined />}>
                导入
              </Button>
            </Upload>
          </Space>
        </div>

        {/* 部门预估投入表格 */}
        <Table<CapabilityDepartmentInvestment>
          className="pms-table pms-hr-investment-table"
          rowKey="id"
          columns={columns}
          dataSource={editData}
          pagination={false}
          size="small"
          tableLayout="fixed"
          scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0), y: 300 }}
          locale={{ emptyText: '暂无部门预估投入数据，请点击「添加部门」或「导入」' }}
        />

      </div>
    </Modal>
  )
}
