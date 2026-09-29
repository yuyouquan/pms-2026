'use client'

import { Fragment, useState } from 'react'
import { Button, Checkbox, Empty, Input, Tooltip } from 'antd'
import { DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import { getProjectPermissionCatalog } from '@/components/permission/projectPermissionCatalog'
import styles from '@/components/permission-center/FunctionalPermissionsTable.module.css'
import shared from '@/components/permission-center/PermissionCenter.module.css'

interface Props {
  project: ProjectItem
  grants: Record<string, boolean>
  disabled: boolean
  onChange: (key: string, enabled: boolean) => void
  onBulkChange?: (keys: string[], enabled: boolean) => void
}

export default function ProjectFunctionalPermissions({ project, grants, disabled, onChange, onBulkChange }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const catalog = getProjectPermissionCatalog(project)
  const query = search.trim().toLocaleLowerCase()
  const groups = catalog.flatMap(group => {
    const rows = group.rows.filter(row => `${group.label} ${row.label} ${row.actions.map(action => action.label).join(' ')}`.toLocaleLowerCase().includes(query))
    return rows.length ? [{ ...group, rows }] : []
  })
  const bulk = (keys: string[], enabled: boolean) => onBulkChange?.([...new Set(keys)], enabled)
  const controls = (label: string, keys: string[]) => <span className={styles.bulkControls}><Tooltip title={query ? '作用于完整目录，包括搜索未显示的权限' : '作用于此菜单下所有权限'}><Button size="small" type="link" aria-label={`全选${label}`} disabled={disabled || !onBulkChange || !keys.length} onClick={() => bulk(keys, true)}>全选</Button></Tooltip><Button size="small" type="link" aria-label={`取消${label}权限`} disabled={disabled || !onBulkChange || !keys.length} onClick={() => bulk(keys, false)}>取消权限</Button></span>
  return <section className={shared.matrixPane} aria-label="项目功能权限">
    <div className={shared.matrixToolbar}>
      <Input prefix={<SearchOutlined />} placeholder="搜索菜单或功能" aria-label="搜索项目功能" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      <Button type="text" disabled={!!query} onClick={() => setCollapsed(collapsed.length === catalog.length ? [] : catalog.map(group => group.id))}>{collapsed.length === catalog.length ? '展开全部' : '收起全部'}</Button>
      <span className={shared.muted}>勾选后实时生效</span>
    </div>
    <div className={shared.matrixScroll}>
      {groups.length ? <table className={styles.permissions} aria-label="项目功能权限表">
        <thead><tr><th scope="col">菜单</th><th scope="col">功能权限</th></tr></thead>
        <tbody>{groups.map(group => {
          const expanded = !!query || !collapsed.includes(group.id)
          return <Fragment key={group.id}>
            <tr className={styles.groupRow}><th colSpan={2}><div className={styles.groupHeader}>
              <button type="button" aria-label={`${expanded ? '收起' : '展开'}${group.label}功能`} aria-expanded={expanded} disabled={!!query}
                onClick={() => setCollapsed(previous => previous.includes(group.id) ? previous.filter(id => id !== group.id) : [...previous, group.id])}>
                {expanded ? <DownOutlined /> : <RightOutlined />} {group.label}
              </button>
              {controls(group.label, catalog.find(item => item.id === group.id)!.rows.flatMap(row => row.actions.map(action => action.key)))}
            </div></th></tr>
            {expanded && group.rows.map(row => <tr key={row.id}>
              <th scope="row"><span className={styles.leafLabel}>{row.label}</span>{controls(row.label, row.actions.map(action => action.key))}</th>
              <td><div className={styles.actions}>{row.actions.map(action => <Checkbox key={action.key} checked={!!grants[action.key]} disabled={disabled}
                aria-label={`${row.label}：${action.label}`} onChange={event => onChange(action.key, event.target.checked)}>{action.label}</Checkbox>)}</div>
                {row.hint && <div className={shared.muted}>{row.hint}</div>}
              </td>
            </tr>)}
            {expanded && group.hint && <tr><td colSpan={2} className={styles.hint}>{group.hint}</td></tr>}
          </Fragment>
        })}</tbody>
      </table> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到功能" />}
    </div>
  </section>
}
