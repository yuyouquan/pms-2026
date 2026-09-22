import type { TransferItem } from '@/lib/transferWorkflow'

export interface EntryImportChange { id: string; content: string; previousContent: string }

/** Material ids disambiguate user-entered sequence numbers and merged template groups. */
export function parseTransferEntryImport(rows: Record<string, unknown>[], items: readonly TransferItem[], canEdit: (item: TransferItem) => boolean): EntryImportChange[] {
  if (!rows.length || !rows.every(row => '资料标识' in row && '录入内容' in row)) throw new Error('请使用当前列表导出的文件，保留资料标识和录入内容列')
  const byId = new Map(items.map(item => [item.id, item]))
  const seen = new Set<string>()
  const changes: EntryImportChange[] = []
  rows.forEach((row, index) => {
    const id = String(row['资料标识'] ?? '').trim()
    const item = byId.get(id)
    if (!item || seen.has(id)) throw new Error(`第 ${index + 2} 行资料不属于当前列表或重复，请重新导出后填写`)
    seen.add(id)
    const content = String(row['录入内容'] ?? '').trim()
    if (!content || content === '-' || content === (item.entryContent || '').trim()) return
    if (!canEdit(item)) throw new Error(`第 ${index + 2} 行当前不可录入，请核对责任人及审核状态`)
    changes.push({ id, content, previousContent: item.entryContent || '' })
  })
  return changes
}
