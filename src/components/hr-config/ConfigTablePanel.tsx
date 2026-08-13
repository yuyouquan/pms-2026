'use client'

import { useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tooltip,
  Popconfirm,
  Tag,
  Upload,
  message,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import * as XLSX from 'xlsx'
import type { ConfigModuleMeta, ConfigRecord } from '@/types/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'
import { exportSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'

interface ConfigTablePanelProps {
  moduleMeta: ConfigModuleMeta
  searchKeyword: string
}

export default function ConfigTablePanel({ moduleMeta, searchKeyword }: ConfigTablePanelProps) {
  const { data, deleteRecord, importRecords, setShowEditModal, setEditingId } = useHrConfigStore()

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
        width: 100,
        fixed: 'right',
        align: 'center',
        render: (_v: unknown, record: ConfigRecord) => (
          <Space size={4}>
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
        ),
      },
    ]

    return [...dataColumns, ...actionColumn]
  }, [moduleMeta, deleteRecord, setEditingId, setShowEditModal])

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

      {/* 数据表格 */}
      <Card className="pms-hr-config-table-card" bordered={false} styles={{ body: { padding: 0 } }}>
        <Table<ConfigRecord>
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
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
    </div>
  )
}
