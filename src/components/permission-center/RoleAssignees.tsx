'use client'

import { useId, useRef, useState } from 'react'
import { Alert, Button, Select } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { PERMISSION_DEPARTMENTS, PERMISSION_USERS, PERMISSION_USER_DEPARTMENTS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { isPermissionCenterAdmin } from '@/lib/permissionCenter'
import { usePermissionStore } from '@/stores/permission'
import type { PermissionCenterModel, PermissionCenterRole, PermissionMutationResult } from '@/types/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { actor: string; model: PermissionCenterModel; role: PermissionCenterRole; conditionDirty: boolean }

export default function RoleAssignees({ actor, model, role, conditionDirty }: Props) {
  const fieldId = useId()
  const [error, setError] = useState('')
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const conditionDirtyRef = useRef(conditionDirty)
  conditionDirtyRef.current = conditionDirty
  const isSuperRole = role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const users = role.members
  const departments = role.departments ?? []
  const mutate = (action: () => PermissionMutationResult) => {
    const result = action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
  }
  const update = (nextUsers: string[], nextDepartments: string[]) => mutate(() => {
    if (conditionDirtyRef.current) return { ok: false, error: '请先完成筛选条件，或明确切换为全部数据，再调整授权范围。当前继续使用上次已生效配置。' }
    return isSuperRole
      ? usePermissionStore.getState().setSuperAdminMembers(actor, nextUsers)
      : usePermissionStore.getState().setCenterRoleAssignees(actor, role.id, { users: nextUsers, departments: nextDepartments })
  })
  return <section className={styles.assignees} aria-label="角色人员配置">
    <div className={styles.assigneeHeading}><strong>人员配置</strong><span className={styles.muted} role="status"><CheckCircleOutlined /> {error ? '自动保存失败' : '已自动保存'}</span></div>
    {error && <Alert className={styles.alert} type="error" showIcon message={error} action={<Button disabled={conditionDirty} onClick={() => { if (retry.current) mutate(retry.current) }}>重试</Button>} />}
    <div className={styles.memberFields}>
      <div className={styles.memberField}><label className={styles.memberLabel} htmlFor={fieldId + '-users'}>授权人员</label>
        <Select id={fieldId + '-users'} className={styles.memberSelect} aria-label="授权人员" mode="multiple" showSearch
          placeholder="搜索并选择人员" value={users} disabled={conditionDirty || (isSuperRole && !isPermissionCenterAdmin(model, actor))}
          options={PERMISSION_USERS.map(user => ({ value: user, label: user, search: user + ' ' + (PERMISSION_USER_DEPARTMENTS[user] ?? []).join(' ') }))}
          filterOption={(input, option) => String(option?.search ?? option?.label ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase())}
          onChange={nextUsers => update(nextUsers, departments)} />
      </div>
      <div className={styles.memberField}><label className={styles.memberLabel} htmlFor={fieldId + '-departments'}>授权部门</label>
        <Select id={fieldId + '-departments'} className={styles.memberSelect} aria-label="授权部门" mode="multiple" showSearch optionFilterProp="label"
          placeholder={isSuperRole ? '系统超级管理员按人员授权' : '搜索并选择部门'} value={departments} disabled={isSuperRole || conditionDirty}
          options={PERMISSION_DEPARTMENTS.map(value => ({ value, label: value }))}
          onChange={nextDepartments => update(users, nextDepartments)} />
      </div>
    </div>
    <div className={styles.muted}>{isSuperRole ? '系统超级管理员拥有全部菜单及操作权限，至少保留一位人员。' : '角色成员在所有已授权菜单中生效；未授予菜单功能时仍无法访问。'}</div>
  </section>
}
