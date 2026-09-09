'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { isLatestHrVersion } from '@/lib/hrVersionRules'
import { Modal, Table, Input, InputNumber, Button, Space, Alert, App, Upload } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import { CAPABILITY_BUDGET_TYPE_LABELS, formatPersonMonth } from '@/constants/hrCapability'
import type { CapabilityDepartmentInvestment } from '@/types/hrCapability'
import { exportSheet } from '@/utils/exportExcel'

interface VersionDetailModalProps {
  open: boolean
  versionId: string | null
  projectId: string
  readOnly?: boolean
  onCancel: () => void
}

export default function VersionDetailModal({
  open,
  versionId,
  projectId,
  readOnly: requestedReadOnly = false,
  onCancel,
}: VersionDetailModalProps) {
  const { message } = App.useApp()
  const projects = useHrCapabilityStore((s) => s.projects)
  const updateVersionDepartmentInvestments = useHrCapabilityStore((s) => s.updateVersionDepartmentInvestments)
  const setShowVersionDetailModal = useHrCapabilityStore((s) => s.setShowVersionDetailModal)

  const { project, version } = useMemo(() => {
    const p = projects.find((pp) => pp.id === projectId)
    if (!p) return { project: null, version: null }
    const v = p.versions.find((vv) => vv.id === versionId)
    if (!v) return { project: null, version: null }
    return { project: p, version: v }
  }, [projects, projectId, versionId])
  const readOnly = requestedReadOnly || !project || !version || !isLatestHrVersion(project, version)
  const versionRef = useRef(version)
  versionRef.current = version


  const [editData, setEditData] = useState<CapabilityDepartmentInvestment[]>([])

  useEffect(() => {
    const initialVersion = versionRef.current
    if (open && initialVersion) {
      setEditData(initialVersion.departmentInvestments.map((d) => ({ ...d })))
    }
    if (!open) {
      setEditData([])
    }
  }, [open, versionId])

  const editTotal = useMemo(
    () => editData.reduce((sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0),
    [editData],
  )

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

  const handleOk = () => {
    if (!project || !version || readOnly) return
    updateVersionDepartmentInvestments(project.id, version.id, editData)
    message.success('部门预估投入已更新')
  }

  const handleCancel = () => {
    setShowVersionDetailModal(false)
    onCancel()
  }

  const columns: ColumnsType<CapabilityDepartmentInvestment> = useMemo(() => {
    const base: ColumnsType<CapabilityDepartmentInvestment> = [
      {
        title: '一级部门',
        key: 'primaryDepartment',
        width: 160,
        fixed: 'left' as const,
        render: (_value: unknown, record: CapabilityDepartmentInvestment) => (
          <Input
            value={record.primaryDepartment}
            placeholder="请输入一级部门"
            disabled={readOnly}
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
            disabled={readOnly}
            onChange={(e) => updateRow(record.id, 'secondaryDepartment', e.target.value)}
          />
        ),
      },
      {
        title: '预估投入（人月）',
        key: 'estimatedInvestment',
        width: 150,
        align: 'right' as const,
        render: (_value: unknown, record: CapabilityDepartmentInvestment) =>
          readOnly ? (
            <span style={{ fontWeight: 600 }}>
              {formatPersonMonth(Number(record.estimatedInvestment) || 0)}
            </span>
          ) : (
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
    ]

    if (!readOnly) {
      base.push({
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
      })
    }

    return base
  }, [readOnly])

  if (!project || !version) return null

  return (
    <Modal
      className="pms-modal"
      title={readOnly ? '版本详情' : '版本详情 - 部门预估投入'}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="保存"
      cancelText={readOnly ? '关闭' : '取消'}
      footer={
        readOnly
          ? [<Button key="close" onClick={handleCancel}>关闭</Button>]
          : undefined
      }
      width={900}
    >
      <div style={{ marginTop: 16 }}>
        {/* 版本信息头部 */}
        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            gap: 24,
            fontSize: 12,
            color: 'var(--pms-text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <span>项目名称：<strong style={{ color: 'var(--pms-text-primary)' }}>{project.name}</strong></span>
          <span>预算类型：<strong style={{ color: 'var(--pms-text-primary)' }}>{CAPABILITY_BUDGET_TYPE_LABELS[version.budgetType]}</strong></span>
          <span>版本号：<strong style={{ color: 'var(--pms-text-primary)' }}>{version.versionNumber}</strong></span>
          <span>项目起止：<strong style={{ color: 'var(--pms-text-primary)' }}>{version.projectStartTime} ~ {version.projectEndTime}</strong></span>
          <span>预估投入：<strong style={{ color: 'var(--pms-text-primary)' }}>{formatPersonMonth(version.estimatedInvestment)}</strong></span>
        </div>

        {/* 合计提示 */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`预估投入合计：${formatPersonMonth(editTotal)}`}
        />

        {/* 操作按钮 */}
        {!readOnly && (
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
        )}

        {/* 部门预估投入表格 */}
        <Table<CapabilityDepartmentInvestment>
          className="pms-table pms-hr-investment-table"
          rowKey="id"
          columns={columns}
          dataSource={editData}
          pagination={false}
          size="small"
          tableLayout="fixed"
          scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0), y: 320 }}
          locale={{
            emptyText: readOnly
              ? '暂无部门预估投入数据'
              : '暂无部门预估投入数据，请点击「添加部门」',
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
              {readOnly ? '部门预估投入列表合计' : '编辑各部门预估投入，合计将自动更新'}
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
