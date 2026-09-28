'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { PERMISSION_ACTION_LABELS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { createEmptyMenuPolicy, evaluateMenuPermission, isRoleAssignedToUser, validateMenuPolicy } from '@/lib/permissionCenter'
import { usePermissionStore } from '@/stores/permission'
import type { MenuPolicy, PermissionAction, PermissionCenterModel, PermissionCenterRole, PermissionMenu, PermissionMutationResult } from '@/types/permissionCenter'
import { buildPermissionMatrixRows } from '@/components/permission-center/menuTree'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { model: PermissionCenterModel; actor?: string; role?: PermissionCenterRole; person?: string; conditionDirty?: boolean }

export default function FunctionalMatrix({ model, actor, role, person, conditionDirty }: Props) {
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const { rows, depth } = buildPermissionMatrixRows(search)
  const superRole = role?.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const sourceRoles = person ? model.roles.filter(item => isRoleAssignedToUser(item, person)) : []
  const mutate = (action: () => PermissionMutationResult) => {
    const result = action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
  }
  const toggle = (menu: PermissionMenu, action: PermissionAction, checked: boolean) => {
    if (!role || !actor) return
    mutate(() => usePermissionStore.getState().updateMenuPolicy(actor, role.id, menu.id, previous => {
      let valid = false
      try { valid = validateMenuPolicy(previous).ok } catch { /* Invalid saved rules remain denied. */ }
      if (!valid && model.policies.some(item => item.roleId === role.id && item.menuId === menu.id)) return previous
      const policy: MenuPolicy = valid ? previous : createEmptyMenuPolicy(role.id, menu.id)
      return { ...policy, actions: checked ? [...new Set([...policy.actions, action])] : policy.actions.filter(value => value !== action) }
    }))
  }
  return <div className={styles.matrixPane}>
    <div className={styles.matrixToolbar}>
      <Input prefix={<SearchOutlined />} allowClear placeholder="搜索功能菜单" aria-label="搜索功能菜单" value={search} onChange={event => setSearch(event.target.value)} />
      <span className={styles.muted}>{person ? '有效权限只读，按来源角色合并' : '勾选后立即生效'}</span>
    </div>
    {error && <Alert className={styles.alert} type="error" showIcon message={error} action={<Button onClick={() => { if (retry.current) mutate(retry.current) }}>重试</Button>} />}
    {rows.length ? <div className={styles.matrixScroll}><table className={styles.matrix} aria-label={person ? '人员有效功能权限' : '角色功能权限'}>
      <thead><tr>{Array.from({ length: depth }, (_, index) => <th key={index} scope="col">{index === 0 ? '模块' : '上级菜单'}</th>)}<th scope="col">子菜单</th><th scope="col">功能权限</th>{person && <th scope="col">来源角色</th>}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const policy = role && model.policies.find(item => item.roleId === role.id && item.menuId === row.menu.id)
        let valid = false
        try { valid = !!policy && validateMenuPolicy(policy).ok } catch { /* Invalid saved rules cannot grant. */ }
        const checked = (action: PermissionAction) => person ? evaluateMenuPermission(model, person, row.menu.id, action) : superRole || (valid && !!policy?.actions.includes(action))
        const sources = sourceRoles.filter(source => source.id === SUPER_ADMIN_ROLE_ID || model.policies.some(item => {
          if (item.roleId !== source.id || item.menuId !== row.menu.id) return false
          try { return validateMenuPolicy(item).ok && item.actions.some(action => row.menu.actions.includes(action)) } catch { return false }
        }))
        return <tr key={row.menu.id}>{Array.from({ length: depth }, (_, level) => row.spans[level] > 0
          ? <th key={level} scope="rowgroup" rowSpan={row.spans[level]} className={styles.parentCell}>{row.parents[level]}</th>
          : null)}
          <th scope="row" className={styles.leafCell}>{row.leaf}</th>
          <td><div className={styles.actions}>{row.menu.actions.map(action => <Checkbox key={action} checked={checked(action)}
            disabled={!!person || !!superRole || conditionDirty || (!!policy && !valid)} onChange={event => toggle(row.menu, action, event.target.checked)}>
            {PERMISSION_ACTION_LABELS[action]}</Checkbox>)}</div>
            {role && policy && !valid && <div className={styles.invalidPolicy}>策略无效，当前不授权。
              <Button type="link" size="small" disabled={conditionDirty} onClick={() => mutate(() => usePermissionStore.getState().updateMenuPolicy(actor!, role.id, row.menu.id, createEmptyMenuPolicy(role.id, row.menu.id)))}>重置为空策略</Button>
            </div>}
          </td>
          {person && <td className={styles.sourceCell}>{sources.map(source => source.name).join('、') || '无'}</td>}
        </tr>
      })}</tbody>
    </table></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到菜单" />}
  </div>
}
