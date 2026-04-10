import * as XLSX from 'xlsx'
import { message } from 'antd'
import dayjs from 'dayjs'

export interface ExportColumn {
  /** 数据字段 key */
  key: string
  /** 表头文本 */
  title: string
  /** 列宽（字符数），未指定时自动计算 */
  width?: number
  /** 单元格值格式化函数 */
  formatter?: (value: any, row: any) => string | number
}

/**
 * 导出扁平表格为 xlsx 文件。
 * - 空数据时给出 warning 并中止
 * - 自动列宽：max(title.length, 前 100 行字符长度) * 1.2，上限 40
 * - 空值统一输出 '-'
 */
export function exportSheet(
  rows: any[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Sheet1',
): void {
  if (!rows || rows.length === 0) {
    message.warning('暂无可导出数据')
    return
  }
  try {
    const header = columns.map(c => c.title)
    const body = rows.map(row =>
      columns.map(col => {
        const raw = row[col.key]
        const val = col.formatter ? col.formatter(raw, row) : raw
        if (val === undefined || val === null || val === '') return '-'
        return val
      }),
    )
    const aoa: (string | number)[][] = [header, ...body]
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // 自动列宽
    const sample = body.slice(0, 100)
    ws['!cols'] = columns.map((col, ci) => {
      if (col.width) return { wch: col.width }
      let maxLen = strWidth(col.title)
      for (const row of sample) {
        maxLen = Math.max(maxLen, strWidth(String(row[ci] ?? '')))
      }
      return { wch: Math.min(40, Math.ceil(maxLen * 1.2) + 2) }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    message.success(`已导出 ${filename}`)
  } catch (err) {
    console.error('[exportSheet] failed', err)
    message.error('导出失败，请重试')
  }
}

/** 生成带时间戳的文件名后缀 */
export function exportTimestamp(): string {
  return dayjs().format('YYYYMMDD_HHmm')
}

/** 估算字符显示宽度（中文算 2，其他算 1） */
function strWidth(s: string): number {
  let n = 0
  for (const ch of s) {
    n += /[\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return n
}
