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
  const [onlyGranted, setOnlyGranted] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const catalog = getProjectPermissionCatalog(project)
  const query = search.trim().toLocaleLowerCase()
  const filtering = !!query || onlyGranted
  const groups = catalog.flatMap(group => {
    const rows = group.rows.filter(row => (!onlyGranted || row.actions.some(action => grants[action.key])) && `${group.label} ${row.label} ${row.actions.map(action => action.label).join(' ')}`.toLocaleLowerCase().includes(query))
    return rows.length ? [{ ...group, rows }] : []
  })
  const bulk = (keys: string[], enabled: boolean) => onBulkChange?.([...new Set(keys)], enabled)
  const controls = (label: string, keys: string[]) => {
    const checked = keys.length > 0 && keys.every(key => grants[key])
    return <Tooltip title={filtering ? '全选 / 取消全选当前筛选菜单的权限' : '全选 / 取消全选'}>
      <Checkbox className={styles.bulkCheckbox} aria-label={`${label}全部权限`} checked={checked}
        indeterminate={!checked && keys.some(key => grants[key])} disabled={disabled || !onBulkChange || !keys.length}
        onChange={event => bulk(keys, event.target.checked)} />
    </Tooltip>
  }
  return <section className={shared.matrixPane} aria-label="项目功能权限">
    <div className={shared.matrixToolbar}>
      <Input prefix={<SearchOutlined />} placeholder="搜索菜单或功能" aria-label="搜索项目功能" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      <Checkbox aria-label="仅看已授权" checked={onlyGranted} onChange={event => setOnlyGranted(event.target.checked)}>仅看已授权</Checkbox>
      <Button type="text" disabled={filtering || !groups.length} onClick={() => setCollapsed(collapsed.length === catalog.length ? [] : catalog.map(group => group.id))}>{collapsed.length === catalog.length ? '展开全部' : '收起全部'}</Button>
      <span className={shared.muted}>{disabled ? '功能权限只读' : filtering ? '实时生效 · 全选仅作用于筛选菜单' : '勾选后实时生效'}</span>
    </div>
    <div className={shared.matrixScroll}>
      {groups.length ? <table className={`${styles.permissions} ${disabled ? styles.readOnly : ''}`} aria-label="项目功能权限表">
        <thead><tr><th scope="col">菜单</th><th scope="col">功能权限</th></tr></thead>
        <tbody>{groups.map(group => {
          const expanded = filtering || !collapsed.includes(group.id)
          return <Fragment key={group.id}>
            <tr className={styles.groupRow}><th colSpan={2}><div className={styles.groupHeader}>
              {controls(group.label, group.rows.flatMap(row => row.actions.map(action => action.key)))}
              <button type="button" aria-label={`${expanded ? '收起' : '展开'}${group.label}功能`} aria-expanded={expanded} disabled={filtering}
                onClick={() => setCollapsed(previous => previous.includes(group.id) ? previous.filter(id => id !== group.id) : [...previous, group.id])}>
                {expanded ? <DownOutlined /> : <RightOutlined />} {group.label}
              </button>
            </div></th></tr>
            {expanded && group.rows.map(row => <tr key={row.id}>
              <th scope="row"><span className={styles.leafLabel}>{controls(row.label, row.actions.map(action => action.key))}<span>{row.label}</span></span></th>
              <td><div className={styles.actions}>{row.actions.map(action => <Checkbox key={action.key} checked={!!grants[action.key]} disabled={disabled}
                aria-label={`${row.label}：${action.label}`} onChange={event => onChange(action.key, event.target.checked)}>{action.label}</Checkbox>)}</div>
              </td>
            </tr>)}
          </Fragment>
        })}</tbody>
      </table> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={onlyGranted ? query ? '当前搜索下暂无已授权菜单' : '暂无已授权菜单' : '未找到功能'} />}
    </div>
  </section>
}
