'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Space, Table, Upload, message } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { TransferItem } from '@/lib/transferWorkflow'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import { parseTransferEntryImport, type EntryImportChange } from '@/components/transfer/transferEntryImport'

export function TransferEntryExchange({ items, title, canEdit, onImport }: {
  items: TransferItem[]; title: string; canEdit: (item: TransferItem) => boolean; onImport: (changes: EntryImportChange[]) => boolean
}) {
  const [changes, setChanges] = useState<EntryImportChange[] | null>(null)
  const [reading, setReading] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const exportItems = () => exportSheet(items, [
    { key: 'seq', title: '序号' },
    { key: 'checkItem', title: '标准', formatter: (_, row: TransferItem) => 'checkItem' in row ? row.checkItem : row.standard },
    { key: 'type', title: '类型' },
    ...(!('checkItem' in (items[0] || {})) ? [{ key: 'description', title: '说明' }] : []),
    { key: 'responsibleRole', title: '责任角色' }, { key: 'entryPerson', title: '资料录入-责任人' },
    { key: 'reviewPerson', title: '人工审核-责任人' }, { key: 'aiCheckRule', title: '智能检查规则' },
    { key: 'entryContent', title: '录入内容', width: 40 }, { key: 'id', title: '资料标识', width: 36 },
  ], `${title.replace(/[\\/:*?"<>|]/g, '_')}_${exportTimestamp()}.xlsx`, '转维资料')
  return <>
    <Upload accept=".xlsx,.xls" showUploadList={false} disabled={reading || !items.some(item => canEdit(item))} beforeUpload={async file => {
      setReading(true)
      try {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        if (!alive.current) return false
        const next = parseTransferEntryImport(rows, items, canEdit)
        if (next.length) setChanges(next)
        else message.info('没有需要导入的新内容')
      } catch (error) { if (alive.current) message.error(error instanceof Error ? error.message : '文件读取失败，请检查 Excel 文件') }
      finally { if (alive.current) setReading(false) }
      return false
    }}><Button size="small" icon={<UploadOutlined />} loading={reading} disabled={!items.some(item => canEdit(item))}>导入</Button></Upload>
    <Button size="small" icon={<DownloadOutlined />} onClick={exportItems} disabled={!items.length}>导出</Button>
    <Modal className="pms-modal pms-transfer-surface" title="导入录入内容" width={760} open={Boolean(changes)} onCancel={() => setChanges(null)} footer={<Space><Button onClick={() => setChanges(null)}>取消</Button><Button type="primary" onClick={() => { if (changes && onImport(changes)) setChanges(null) }}>确认导入</Button></Space>}>
      <Alert type="info" showIcon message="导入后保存为暂存。请逐项确认提交，完成 AI 检查后再提交角色审核。空白内容不会覆盖现有资料。" style={{ marginBottom: 16 }} />
      <Table rowKey="id" size="small" pagination={false} scroll={{ y: 320 }} dataSource={changes || []} columns={[
        { title: '序号', width: 70, render: (_, row: EntryImportChange) => items.find(item => item.id === row.id)?.seq },
        { title: '标准', width: 200, render: (_, row: EntryImportChange) => { const item = items.find(item => item.id === row.id); return item && ('checkItem' in item ? item.checkItem : item.standard) } },
        { title: '录入内容', dataIndex: 'content', render: (value: string) => <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</span> },
      ]} />
    </Modal>
  </>
}
