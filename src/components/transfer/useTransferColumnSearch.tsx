'use client'

import { useRef } from 'react'
import { Button, Input, Space, type InputRef } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'
import type { TransferItem } from '@/lib/transferWorkflow'
import { matchesTransferColumnSearch } from '@/components/transfer/transferInteraction'

export function useTransferColumnSearch() {
  const input = useRef<InputRef>(null)
  return (field: 'checkItem' | 'description', label: string): Pick<ColumnType<TransferItem>, 'filterDropdown' | 'filterIcon' | 'onFilter' | 'filterDropdownProps'> => ({
    filterDropdown: ({ selectedKeys, setSelectedKeys, confirm, clearFilters }) => <div style={{ padding: 8 }} onKeyDown={event => event.stopPropagation()}>
      <Input ref={input} aria-label={`搜索${label}`} placeholder="搜索" value={selectedKeys[0] as string} onChange={event => setSelectedKeys(event.target.value ? [event.target.value] : [])} onPressEnter={() => confirm()} style={{ display: 'block', marginBottom: 8 }} />
      <Space><Button size="small" type="primary" icon={<SearchOutlined />} onClick={() => confirm()}>搜索</Button><Button size="small" onClick={() => { clearFilters?.(); confirm() }}>重置</Button></Space>
    </div>,
    filterIcon: filtered => <SearchOutlined aria-label={`筛选${label}`} style={{ color: filtered ? 'var(--pms-brand)' : undefined }} />,
    onFilter: (value, item) => matchesTransferColumnSearch(item, field, value),
    filterDropdownProps: { onOpenChange: open => { if (open) setTimeout(() => input.current?.select(), 100) } },
  })
}
