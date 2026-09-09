'use client'

import { useMemo, useState } from 'react'
import {
  App,
  Card,
  Table,
  Button,
  Space,
  Tooltip,
  Popconfirm,
  Tag,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  StopOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import * as XLSX from 'xlsx'
import type { ConfigModuleMeta, ConfigRecord } from '@/types/hrConfig'
import { getHrModelVersionGroup, useHrConfigStore } from '@/stores/hrConfig'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import HrModelStatisticsModal from '@/components/hr-config/HrModelStatisticsModal'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'

interface ConfigTablePanelProps {
  moduleMeta: ConfigModuleMeta
  searchKeyword: string
}

export default function ConfigTablePanel({ moduleMeta, searchKeyword }: ConfigTablePanelProps) {
  const { message, modal } = App.useApp()
  const { data, deleteRecord, toggleRecordStatus, importRecords, setShowEditModal, setEditingId } = useHrConfigStore()
  const { isValidPair } = useHrDepartmentOptions()
  const [showStatistics, setShowStatistics] = useState(false)

  const records = data[moduleMeta.key] ?? []

  // ── 搜索过滤 ──────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!searchKeyword.trim()) return records
    const kw = searchKeyword.trim().toLowerCase()
    return records.filter(r =>
      moduleMeta.columns.some(col => {
        const val = r[col.key]
        return val != null && String(val).toLowerCase().includes(kw)
      }),
    )
  }, [records, searchKeyword, moduleMeta.columns])

  // ── 表格列 ────────────────────────────────────────────────
  const columns = useMemo<ColumnsType<ConfigRecord>>(() => {
    const dataColumns: ColumnsType<ConfigRecord> = moduleMeta.columns.map(col => ({
      title: col.label,
      dataIndex: col.key,
      key: col.key,
      width: col.width ?? 120,
      align: col.align ?? 'left',
      render: (value: unknown) => {
        if (value === null || value === undefined || value === '') return '-'
        if (typeof value === 'number') {
          return <span style={{ fontWeight: 500 }}>{value}</span>
        }
        // select 类型显示 Tag
        if (col.inputType === 'select' && col.options) {
          const opt = col.options.find(o => o.value === String(value))
          return <Tag style={{ marginInlineEnd: 0 }}>{opt?.label ?? String(value)}</Tag>
        }
        return String(value)
      },
    }))

    const actionColumn: ColumnsType<ConfigRecord> = [
      {
        title: '操作',
        key: '_action',
        width: 150,
        fixed: 'right',
        align: 'center',
        render: (_v: unknown, record: ConfigRecord) => {
          const isDisabled = record.enabled === false
          return (
            <Space size={4}>
              <Tooltip title={isDisabled ? '启用' : '禁用'}>
                <Button
                  type="text"
                  size="small"
                  icon={isDisabled ? <CheckCircleOutlined /> : <StopOutlined />}
                  style={isDisabled ? { color: 'var(--pms-brand-strong)' } : { color: 'var(--pms-text-tertiary)' }}
                  onClick={() => {
                    if (moduleMeta.key === 'hrModel') {
                      const action = isDisabled ? '启用' : '禁用'
                      const affectedRecords = getHrModelVersionGroup(records, record)
                      modal.confirm({
                        title: `确认${action}模型版本`,
                        content: (
                          <div>
                            <div>模型版本：{String(record.modelVersion ?? '').trim() || '未填写'}</div>
                            <div>将{action} {affectedRecords.length} 条配置记录，涵盖该版本下全部项目等级和部门。</div>
                          </div>
                        ),
                        okText: action,
                        cancelText: '取消',
                        okButtonProps: { danger: !isDisabled },
                        onOk: () => {
                          toggleRecordStatus(moduleMeta.key, record.id, isDisabled)
                          message.success(`模型版本已${action}`)
                        },
                      })
                    } else {
                      toggleRecordStatus(moduleMeta.key, record.id)
                      message.success(isDisabled ? '已启用' : '已禁用')
                    }
                  }}
                />
              </Tooltip>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingId(record.id)
                    setShowEditModal(true)
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="确认删除"
                description="确定要删除这条配置吗？"
                onConfirm={() => {
                  deleteRecord(moduleMeta.key, record.id)
                  message.success('已删除')
                }}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="删除">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </Space>
          )
        },
      },
    ]

    return [...dataColumns, ...actionColumn]
  }, [moduleMeta, records, deleteRecord, toggleRecordStatus, setEditingId, setShowEditModal, message, modal])

  // ── 导出 ──────────────────────────────────────────────────
  const handleExport = () => {
    const exportColumns: ExportColumn[] = moduleMeta.columns.map(col => ({
      key: col.key,
      title: col.label,
      width: col.width ? Math.ceil(col.width / 6) + 4 : 12,
    }))
    exportSheet(
      filteredRecords,
      exportColumns,
      `${moduleMeta.label}_${exportTimestamp()}.xlsx`,
      moduleMeta.label,
    )
  }

  // ── 导入 ──────────────────────────────────────────────────
  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const wb = XLSX.read(data, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws)

          if (rows.length === 0) {
            message.warning('导入文件无数据')
            return
          }

          // 按列定义映射
          const colMap = new Map<string, string>()
          moduleMeta.columns.forEach(col => {
            colMap.set(col.label, col.key)
          })

          const newRecords: ConfigRecord[] = rows.map((row, idx) => {
            const record: ConfigRecord = {
              id: `cfg-${moduleMeta.key}-imp-${Date.now()}-${idx}`,
            }
            for (const [excelHeader, value] of Object.entries(row)) {
              const dataKey = colMap.get(excelHeader)
              if (dataKey) {
                // 数值列转换
                const colDef = moduleMeta.columns.find(c => c.key === dataKey)
                if (colDef?.inputType === 'number') {
                  record[dataKey] = Number(value) || 0
                } else {
                  record[dataKey] = String(value)
                }
              }
            }
            return record
          })

          if (moduleMeta.key === 'hrModel') {
            const invalidDepartmentIndex = newRecords.findIndex(record => !isValidPair(
              String(record.primaryDepartment ?? ''), String(record.secondaryDepartment ?? ''),
            ))
            if (invalidDepartmentIndex >= 0) {
              message.error(`第 ${invalidDepartmentIndex + 2} 行一级部门与二级部门不匹配，请使用现有部门组合`)
              return
            }
          }

          importRecords(moduleMeta.key, newRecords)
          message.success(`成功导入 ${newRecords.length} 条记录`)
        } catch {
          message.error('导入失败，请检查文件格式')
        }
      }
      reader.readAsArrayBuffer(file)
      return false // prevent auto upload
    },
  }

  // ── 下载导入模板 ──────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const header = moduleMeta.columns.map(c => c.label)
    const aoa = [header]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = moduleMeta.columns.map(c => ({ wch: (c.width ?? 120) / 6 + 4 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, moduleMeta.label)
    XLSX.writeFile(wb, `${moduleMeta.label}_导入模板.xlsx`)
    message.success('模板已下载')
  }

  return (
    <div className="pms-hr-config-panel">
      {/* 工具栏 */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ marginBottom: 12 }}
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setShowEditModal(true)
              }}
            >
              新增
            </Button>
            {moduleMeta.key === 'hrModel' && (
              <Button icon={<BarChartOutlined />} onClick={() => setShowStatistics(true)}>
                模型版本统计
              </Button>
            )}
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>导入</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Tooltip title="下载导入模板">
              <Button type="link" size="small" onClick={handleDownloadTemplate}>
                下载模板
              </Button>
            </Tooltip>
          </Space>

          <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
            共 {filteredRecords.length} 条记录
          </span>
        </div>
      </Card>

      {moduleMeta.key === 'hrModel' && (
        <HrModelStatisticsModal open={showStatistics} records={data.hrModel} onCancel={() => setShowStatistics(false)} />
      )}

      {/* 数据表格 */}
      <Card className="pms-hr-config-table-card" variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<ConfigRecord>
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          rowClassName={(record) => record.enabled === false ? 'pms-config-row-disabled' : ''}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </Card>

      <style jsx global>{`
        .pms-config-row-disabled {
          opacity: 0.5;
          background: var(--pms-brand-surface) !important;
        }
        .pms-config-row-disabled td {
          color: var(--pms-text-tertiary) !important;
        }
      `}</style>
    </div>
  )
}
