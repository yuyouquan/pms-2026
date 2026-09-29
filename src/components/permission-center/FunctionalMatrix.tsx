'use client'

import { Fragment, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Checkbox, Empty, Input, Tooltip } from 'antd'
import { DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import { PERMISSION_ACTION_LABELS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { createEmptyMenuPolicy, evaluateMenuPermission, isRoleAssignedToUser, validateMenuPolicy } from '@/lib/permissionCenter'
import { usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import type { MenuPolicy, PermissionAction, PermissionCenterModel, PermissionCenterRole, PermissionMenu, PermissionMutationResult } from '@/types/permissionCenter'
import { buildPermissionMenuTree, CONFIGURABLE_PERMISSION_MENUS, getMenuGroupKeys, type PermissionMenuNode } from '@/components/permission-center/menuTree'
import tableStyles from '@/components/permission-center/FunctionalPermissionsTable.module.css'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { model: PermissionCenterModel; actor?: string; role?: PermissionCenterRole; person?: string; conditionDirty?: boolean }

export default function FunctionalMatrix({ model, actor, role, person, conditionDirty }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [error, setError] = useState('')
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const nodes = buildPermissionMenuTree(search)
  const groupKeys = getMenuGroupKeys(nodes)
  const searching = !!search.trim()
  const allCollapsed = groupKeys.length > 0 && groupKeys.every(key => collapsed.includes(key))
  const superRole = role?.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const sourceRoles = person ? model.roles.filter(item => isRoleAssignedToUser(item, person)) : []
  const mutate = (action: () => PermissionMutationResult) => {
    const result = action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
  }
  const liveActor = () => !!actor && useProjectStore.getState().currentLoginUser === actor
  const allNodes = buildPermissionMenuTree()
  const descendants = (node: PermissionMenuNode): PermissionMenu[] => node.children ? node.children.flatMap(descendants) : CONFIGURABLE_PERMISSION_MENUS.filter(menu => menu.id === node.key)
  const findFull = (key: string, items: PermissionMenuNode[] = allNodes): PermissionMenuNode | undefined => {
    for (const item of items) { if (item.key === key) return item; const nested = item.children && findFull(key, item.children); if (nested) return nested }
  }
  const bulkControls = (node: PermissionMenuNode, path: string) => {
    const all = descendants(findFull(node.key) ?? node)
    const invalid = !!role && all.some(menu => { const policy = model.policies.find(item => item.roleId === role.id && item.menuId === menu.id); if (!policy) return false; try { return !validateMenuPolicy(policy).ok } catch { return true } })
    const disabled = !role || !actor || !!person || !!superRole || !!conditionDirty || invalid || !all.length
    const change = (enabled: boolean) => {
      if (disabled) return
      mutate(() => !liveActor() ? { ok: false, error: '当前用户已变化，请重新打开权限配置。' } : usePermissionStore.getState().updateMenuActionsBulk(actor!, role!.id, all.map(menu => ({ menuId: menu.id, actions: menu.actions })), enabled))
    }
    return <span className={tableStyles.bulkControls}><Tooltip title={searching ? '作用于完整目录，包括搜索未显示的权限' : '作用于此菜单及下级全部权限'}><Button size="small" type="link" aria-label={`全选${path}`} disabled={disabled} onClick={() => change(true)}>全选</Button></Tooltip><Button size="small" type="link" aria-label={`取消${path}权限`} disabled={disabled} onClick={() => change(false)}>取消权限</Button></span>
  }
  const toggle = (menu: PermissionMenu, action: PermissionAction, checked: boolean) => {
    if (!role || !actor) return
    mutate(() => !liveActor() ? { ok: false, error: '当前用户已变化，请重新打开权限配置。' } : usePermissionStore.getState().updateMenuPolicy(actor, role.id, menu.id, previous => {
      let valid = false
      try { valid = validateMenuPolicy(previous).ok } catch { /* Invalid saved rules remain denied. */ }
      if (!valid && model.policies.some(item => item.roleId === role.id && item.menuId === menu.id)) return previous
      const policy: MenuPolicy = valid ? previous : createEmptyMenuPolicy(role.id, menu.id)
      return { ...policy, actions: checked ? [...new Set([...policy.actions, action])] : policy.actions.filter(value => value !== action) }
    }))
  }
  const renderNodes = (items: PermissionMenuNode[], parents: string[] = []): ReactNode => items.map(node => {
    const indent = 12 + parents.length * 18
    const path = [...parents, node.label].join(' / ')
    if (node.children) {
      const expanded = searching || !collapsed.includes(node.key)
      return <Fragment key={node.key}>
        <tr className={tableStyles.groupRow}><th colSpan={2}>
          <div className={tableStyles.groupHeader}><button type="button" style={{ paddingInlineStart: indent }} aria-label={`${expanded ? '收起' : '展开'}${path}功能`} aria-expanded={expanded} disabled={searching}
            onClick={() => setCollapsed(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key])}>
            {expanded ? <DownOutlined /> : <RightOutlined />} {node.label}
          </button>{bulkControls(node, path)}</div>
        </th></tr>
        {expanded && renderNodes(node.children, [...parents, node.label])}
      </Fragment>
    }
    const menu = CONFIGURABLE_PERMISSION_MENUS.find(item => item.id === node.key)!
    const policy = role && model.policies.find(item => item.roleId === role.id && item.menuId === menu.id)
    let valid = false
    try { valid = !!policy && validateMenuPolicy(policy).ok } catch { /* Invalid saved rules cannot grant. */ }
    const checked = (action: PermissionAction) => person ? evaluateMenuPermission(model, person, menu.id, action) : superRole || (valid && !!policy?.actions.includes(action))
    const sources = sourceRoles.filter(source => source.id === SUPER_ADMIN_ROLE_ID || model.policies.some(item => {
      if (item.roleId !== source.id || item.menuId !== menu.id) return false
      try { return validateMenuPolicy(item).ok && item.actions.some(action => menu.actions.includes(action)) } catch { return false }
    }))
    return <tr key={menu.id}>
      <th scope="row"><span className={styles.functionalMenuLabel} style={{ paddingInlineStart: indent }}>{node.label}</span>{bulkControls(node, path)}</th>
      <td><div className={tableStyles.actions}>{menu.actions.map(action => <Checkbox key={action} checked={checked(action)}
        aria-label={`${path}：${PERMISSION_ACTION_LABELS[action]}`}
        disabled={!!person || !!superRole || conditionDirty || (!!policy && !valid)} onChange={event => toggle(menu, action, event.target.checked)}>
        {PERMISSION_ACTION_LABELS[action]}</Checkbox>)}</div>
        {role && policy && !valid && <div className={styles.invalidPolicy}>策略无效，当前不授权。
          <Button type="link" size="small" disabled={conditionDirty} onClick={() => mutate(() => !liveActor() ? { ok: false, error: '当前用户已变化，请重新打开权限配置。' } : usePermissionStore.getState().updateMenuPolicy(actor!, role.id, menu.id, createEmptyMenuPolicy(role.id, menu.id)))}>重置为空策略</Button>
        </div>}
        {person && <div className={styles.functionalSources}>来源角色：{sources.map(source => source.name).join('、') || '无'}</div>}
      </td>
    </tr>
  })
  return <div className={styles.matrixPane}>
    <div className={styles.matrixToolbar}>
      <Input prefix={<SearchOutlined />} allowClear placeholder="搜索功能菜单" aria-label="搜索功能菜单" value={search} onChange={event => setSearch(event.target.value)} />
      <Button type="text" disabled={searching || !nodes.length} onClick={() => setCollapsed(allCollapsed ? [] : groupKeys)}>{allCollapsed ? '展开全部' : '收起全部'}</Button>
      <span className={styles.muted}>{person ? '有效权限只读，按来源角色合并' : '勾选后立即生效'}</span>
    </div>
    {error && <Alert className={styles.alert} type="error" showIcon message={error} action={<Button onClick={() => { if (retry.current) mutate(retry.current) }}>重试</Button>} />}
    {nodes.length ? <div className={styles.matrixScroll}><table className={`${tableStyles.permissions} ${styles.functionalTable}`} aria-label={person ? '人员有效功能权限' : '角色功能权限'}>
      <thead><tr><th scope="col">菜单</th><th scope="col">功能权限</th></tr></thead>
      <tbody>{renderNodes(nodes)}</tbody>
    </table></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到菜单" />}
  </div>
}
