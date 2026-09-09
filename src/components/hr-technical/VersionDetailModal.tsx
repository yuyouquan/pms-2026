'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { isLatestHrVersion, formatHrBatch } from '@/lib/hrVersionRules'
import { Modal, Table, Input, InputNumber, Button, Space, Alert, App, Upload } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as XLSX from 'xlsx'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { TECH_BUDGET_TYPE_LABELS, TECH_PHASE_INVESTMENT_FIELDS, formatPersonMonth } from '@/constants/hrTechnical'
import { exportSheet } from '@/utils/exportExcel'
import type { TechDepartmentInvestment, TechPhaseKey } from '@/types/hrTechnical'

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
  const projects = useHrTechnicalStore(s => s.projects)
  const updateVersionDepartmentInvestments = useHrTechnicalStore(s => s.updateVersionDepartmentInvestments)
  const setShowVersionDetailModal = useHrTechnicalStore(s => s.setShowVersionDetailModal)

  // ── 定位版本与所属项目 ──────────────────────────────────────────────
  const { project, version } = useMemo(() => {
    const p = projects.find(pp => pp.id === projectId)
    if (!p) return { project: null, version: null }
    const v = p.versions.find(vv => vv.id === versionId)
    if (!v) return { project: null, version: null }
    return { project: p, version: v }
  }, [projects, projectId, versionId])
  const readOnly = requestedReadOnly || !project || !version || !isLatestHrVersion(project, version)
  const versionRef = useRef(version)
  versionRef.current = version


  // ── 本地编辑态 ──────────────────────────────────────────────────────
  const [editData, setEditData] = useState<TechDepartmentInvestment[]>([])

  useEffect(() => {
    const initialVersion = versionRef.current
    if (open && initialVersion) {
      setEditData(initialVersion.departmentInvestments.map(d => ({ ...d })))
    }
    if (!open) {
      setEditData([])
    }
  }, [open, versionId])

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
        const updated = { ...d, [field]: value }
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
      setEditData(parsed)
      message.success(`已导入 ${parsed.length} 条部门数据`)
    } catch (err) {
      console.error('[import] failed', err)
      message.error('文件解析失败，请检查模板格式')
    }
    return false
  }

  // ── 保存 ────────────────────────────────────────────────────────────
  const handleOk = () => {
    if (!project || !version || readOnly) return
    updateVersionDepartmentInvestments(project.id, version.id, editData)
    message.success('部门预估投入已更新')
  }

  const handleCancel = () => {
    setShowVersionDetailModal(false)
    onCancel()
  }

  // ── 列定义 ──────────────────────────────────────────────────────────
  const columns: ColumnsType<TechDepartmentInvestment> = useMemo(() => {
    const base: ColumnsType<TechDepartmentInvestment> = [
      {
        title: '一级部门',
        key: 'primaryDepartment',
        width: 140,
        fixed: 'left' as const,
        render: (_value: unknown, record: TechDepartmentInvestment) => (
          <Input
            value={record.primaryDepartment}
            placeholder="请输入一级部门"
            disabled={readOnly}
            onChange={e => updateRow(record.id, 'primaryDepartment', e.target.value)}
          />
        ),
      },
      {
        title: '二级部门',
        key: 'secondaryDepartment',
        width: 140,
        fixed: 'left' as const,
        render: (_value: unknown, record: TechDepartmentInvestment) => (
          <Input
            value={record.secondaryDepartment}
            placeholder="请输入二级部门"
            disabled={readOnly}
            onChange={e => updateRow(record.id, 'secondaryDepartment', e.target.value)}
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
            disabled={readOnly}
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
    ]

    if (!readOnly) {
      base.push({
        title: '操作',
        key: 'action',
        width: 80,
        align: 'center' as const,
        render: (_value: unknown, record: TechDepartmentInvestment) => (
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => deleteRow(record.id)}
          >
            删除
          </Button>
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
          ? [
              <Button key="close" onClick={handleCancel}>
                关闭
              </Button>,
            ]
          : undefined
      }
      width={1280}
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
          <span>
            TDT项目：
            <strong style={{ color: 'var(--pms-text-primary)' }}>{project.tdtName}</strong>
          </span>
          <span>
            预算类型：
            <strong style={{ color: 'var(--pms-text-primary)' }}>
              {TECH_BUDGET_TYPE_LABELS[version.budgetType]}
            </strong>
          </span>
          <span>
            版本号：
            <strong style={{ color: 'var(--pms-text-primary)' }}>{version.versionNumber}</strong><span style={{ marginLeft: 8 }}>{formatHrBatch(version.batch)}</span>
          </span>
          <span>
            预估投入：
            <strong style={{ color: 'var(--pms-text-primary)' }}>
              {formatPersonMonth(version.estimatedInvestment)}
            </strong>
          </span>
        </div>

        {/* 合计提示 */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`各阶段预估投入合计：${formatPersonMonth(editTotal)}`}
        />

        {/* 操作按钮：编辑模式下可用 */}
        {!readOnly && (
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
        )}

        {/* 部门预估投入表格 */}
        <Table<TechDepartmentInvestment>
          className="pms-table"
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
              {readOnly
                ? '部门预估投入列表合计'
                : '编辑各阶段预估投入，合计将自动更新'}
            </span>
            <span>
              <span style={{ color: 'var(--pms-text-tertiary)' }}>合计：</span>
              <strong style={{ color: 'var(--pms-brand-strong)', fontSize: 14 }}>
                {formatPersonMonth(editTotal)}
              </strong>
            </span>
          </div>
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
