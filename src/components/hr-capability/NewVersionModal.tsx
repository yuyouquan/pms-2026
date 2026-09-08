'use client'

import { useMemo, useState } from 'react'
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Table,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  message,
  Upload,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { useHrCapabilityStore } from '@/stores/hrCapability'
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
  const [form] = Form.useForm()
  const projects = useHrCapabilityStore((s) => s.projects)
  const selectedProjectId = useHrCapabilityStore((s) => s.selectedProjectId)
  const addVersion = useHrCapabilityStore((s) => s.addVersion)
  const setShowNewVersionModal = useHrCapabilityStore((s) => s.setShowNewVersionModal)

  const [editData, setEditData] = useState<CapabilityDepartmentInvestment[]>([])
  const [budgetType, setBudgetType] = useState<BudgetType | null>(null)
  const [startTime, setStartTime] = useState<dayjs.Dayjs | null>(null)
  const [endTime, setEndTime] = useState<dayjs.Dayjs | null>(null)

  const project = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  // 检查 IPM 绑定限制
  const ipmRequired = budgetType ? CAPABILITY_IPM_REQUIRED_TYPES.includes(budgetType) : false
  const ipmBound = !!(project?.ipmProjectCode)
  const canCreateVersion = !ipmRequired || ipmBound

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
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
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
      setEditData(parsed)
      message.success(`已导入 ${parsed.length} 条部门数据`)
    } catch (err) {
      console.error('[import] failed', err)
      message.error('文件解析失败，请检查模板格式')
    }
    return false
  }

  const handleOk = async () => {
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
    if (endTime < startTime) {
      message.error('项目结束时间不能早于开始时间')
      return
    }
    if (editData.length === 0) {
      message.error('请至少添加一条部门预估投入')
      return
    }
    if (!canCreateVersion) {
      message.error(CAPABILITY_IPM_REQUIRED_TIP)
      return
    }

    addVersion(project.id, {
      budgetType,
      projectStartTime: startTime.format('YYYY-MM-DD'),
      projectEndTime: endTime.format('YYYY-MM-DD'),
      departmentInvestments: editData,
    })
    message.success('版本创建成功')
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
        <Input
          value={record.primaryDepartment}
          placeholder="请输入一级部门"
          onChange={(e) => updateRow(record.id, 'primaryDepartment', e.target.value)}
        />
      ),
    },
    {
      title: '二级部门',
      key: 'secondaryDepartment',
      width: 160,
      fixed: 'left' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
        <Input
          value={record.secondaryDepartment}
          placeholder="请输入二级部门"
          onChange={(e) => updateRow(record.id, 'secondaryDepartment', e.target.value)}
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
      width: 80,
      align: 'center' as const,
      render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
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

  if (!project) return null

  return (
    <Modal
      className="pms-modal"
      title="新建版本"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="创建"
      cancelText="取消"
      width={900}
    >
      <div style={{ marginTop: 16 }}>
        {/* 项目信息 */}
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            gap: 24,
            fontSize: 13,
            color: 'var(--pms-text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <span>项目名称：<strong style={{ color: 'var(--pms-text-primary)' }}>{project.name}</strong></span>
          {project.ipmProjectCode && (
            <span>IPM编码：<strong style={{ color: 'var(--pms-text-primary)' }}>{project.ipmProjectCode}</strong></span>
          )}
        </div>

        {/* IPM 限制提示 */}
        {ipmRequired && !ipmBound && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={CAPABILITY_IPM_REQUIRED_TIP}
          />
        )}

        {/* 表单区 */}
        <Form form={form} layout="vertical">
          <Space size={24} wrap>
            <Form.Item label="预算类型" required>
              <Select
                style={{ width: 180 }}
                placeholder="选择预算类型"
                value={budgetType}
                onChange={(v) => setBudgetType(v)}
                options={CAPABILITY_BUDGET_TYPES.map((t) => ({
                  label: t.label,
                  value: t.value,
                  disabled:
                    CAPABILITY_IPM_REQUIRED_TYPES.includes(t.value) && !ipmBound,
                }))}
              />
            </Form.Item>
            <Form.Item label="项目开始时间" required>
              <DatePicker
                style={{ width: 180 }}
                placeholder="选择开始时间"
                value={startTime}
                onChange={setStartTime}
              />
            </Form.Item>
            <Form.Item label="项目结束时间" required>
              <DatePicker
                style={{ width: 180 }}
                placeholder="选择结束时间"
                value={endTime}
                onChange={setEndTime}
              />
            </Form.Item>
            <Form.Item label="预估投入合计">
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--pms-brand-strong)' }}>
                {formatPersonMonth(editTotal)}
              </span>
              <span style={{ marginLeft: 4, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>人月</span>
            </Form.Item>
          </Space>
        </Form>

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
          className="pms-table"
          rowKey="id"
          columns={columns}
          dataSource={editData}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content', y: 300 }}
          locale={{ emptyText: '暂无部门预估投入数据，请点击「添加部门」或「导入」' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--pms-text-secondary)' }}>
              编辑各部门预估投入，合计将自动更新
            </span>
            <span>
              <span style={{ color: 'var(--pms-text-tertiary)' }}>合计：</span>
              <strong style={{ color: 'var(--pms-brand-strong)', fontSize: 14 }}>
                {formatPersonMonth(editTotal)}
              </strong>
              <span style={{ marginLeft: 4, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>人月</span>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
