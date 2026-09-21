'use client'
import { useState } from 'react'
import { Button, Empty, Input, Modal, Pagination, Select, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, FlagOutlined, HistoryOutlined, LockOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ResourceOperationLog } from '@/types/resourceOperations'

const PAGE_SIZE = 10
function actionAppearance(action: string) {
  if (/删除/.test(action)) return { icon: <DeleteOutlined />, tone: 'danger' }
  if (/创建|复制/.test(action)) return { icon: <PlusOutlined />, tone: 'success' }
  if (/正式|激活/.test(action)) return { icon: <FlagOutlined />, tone: 'brand' }
  if (/锁定|解锁/.test(action)) return { icon: <LockOutlined />, tone: 'neutral' }
  return { icon: <EditOutlined />, tone: 'info' }
}
function displayValue(value: string) { return !value || value === '—' ? '未填写' : value }
function LogEntry({ log }: { log: ResourceOperationLog }) {
  const [expanded, setExpanded] = useState(false)
  const appearance = actionAppearance(log.action)
  const changes = expanded ? log.changes : log.changes.slice(0, 3)
  const timestamp = dayjs(log.timestamp)
  return <article className="pms-resource-audit-entry" aria-label={`${log.versionNumber} ${log.action}`}>
    <div className={`pms-resource-audit-marker pms-resource-audit-${appearance.tone}`} aria-hidden="true">{appearance.icon}</div>
    <div className="pms-resource-audit-card">
      <header className="pms-resource-audit-entry-head">
        <div><strong className={`pms-resource-audit-action pms-resource-audit-${appearance.tone}`}>{log.action}</strong><Tag>{log.versionNumber}</Tag><span className="pms-resource-audit-operator"><UserOutlined />{log.operator || '未知操作人'}</span></div>
        <time dateTime={timestamp.isValid() ? timestamp.toISOString() : undefined}>{timestamp.isValid() ? timestamp.format('HH:mm:ss') : '时间未知'}</time>
      </header>
      {changes.length ? <table className="pms-resource-audit-diff" aria-label={`${log.versionNumber} ${log.action}变更明细`}>
        <thead><tr><th scope="col">变更字段</th><th scope="col">修改前</th><th scope="col">修改后</th></tr></thead>
        <tbody>{changes.map((change, index) => <tr key={index}>
          <th scope="row">{change.field}</th>
          <td className="pms-resource-audit-before">{displayValue(change.before)}</td>
          <td className="pms-resource-audit-after">{displayValue(change.after)}</td>
        </tr>)}</tbody>
      </table> : <p className="pms-resource-audit-no-detail">此操作未记录字段变更</p>}
      {log.changes.length > 3 && <Button type="text" size="small" className="pms-resource-audit-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '收起变更' : `展开全部 ${log.changes.length} 项变更`}</Button>}
    </div>
  </article>
}

export default function ResourceOperationLogDialog({ logs, versionId, budgetLabel, onCancel }: {
  logs: ResourceOperationLog[]; versionId?: string; budgetLabel?: string; onCancel: () => void
}) {
  const [filter, setFilter] = useState(versionId ?? 'all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const versions = [...new Map(logs.map(log => [log.versionId, log.versionNumber])).entries()]
  const keyword = query.trim().toLocaleLowerCase()
  const selected = logs.filter(log => (filter === 'all' || log.versionId === filter) && (!keyword ||
    [log.versionNumber, log.operator, log.action, ...log.changes.flatMap(change => [change.field, change.before, change.after])].some(value => value.toLocaleLowerCase().includes(keyword))))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const current = Math.min(page, Math.max(1, Math.ceil(selected.length / PAGE_SIZE)))
  const visible = selected.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const dateOf = (log: ResourceOperationLog) => dayjs(log.timestamp).isValid() ? dayjs(log.timestamp).format('YYYY-MM-DD') : '日期未知'
  const reset = () => { setFilter('all'); setQuery(''); setPage(1) }
  return <Modal open title={<span className="pms-resource-audit-title"><HistoryOutlined />操作日志{budgetLabel && <small>{budgetLabel}</small>}</span>}
    width={920} footer={null} className="pms-resource-audit-modal" onCancel={onCancel}>
    <div className="pms-resource-audit-toolbar">
      <Select aria-label="日志版本" value={filter} onChange={value => { setFilter(value); setPage(1) }}
        options={[{ value: 'all', label: '所有版本' }, ...versions.map(([value, label]) => ({ value, label }))]} />
      <Input aria-label="搜索操作日志" placeholder="搜索操作人、操作或变更内容" prefix={<SearchOutlined />} allowClear value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
    </div>
    <div className="pms-resource-audit-summary"><span>共 <strong>{selected.length}</strong> 条记录</span><span>最新操作在前</span></div>
    <div className="pms-resource-audit-list" key={`${filter}-${keyword}-${current}`}>
      {visible.length ? <ol>{visible.map((log, index) => <li key={log.id}>
        {(!index || dateOf(log) !== dateOf(visible[index - 1])) && <div className="pms-resource-audit-date">{dateOf(log)}</div>}
        <LogEntry log={log} />
      </li>)}</ol> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={logs.length ? '没有符合筛选条件的操作记录' : '暂无操作日志'}>
        {logs.length > 0 && <Button onClick={reset}>重置筛选</Button>}
      </Empty>}
    </div>
    {selected.length > PAGE_SIZE && <div className="pms-resource-audit-pagination"><Pagination size="small" current={current} total={selected.length} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={setPage} /></div>}
  </Modal>
}
