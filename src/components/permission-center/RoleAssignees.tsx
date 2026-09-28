'use client'

import { useRef, useState } from 'react'
import { Button, Tag } from 'antd'
import { SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { isPermissionCenterAdmin } from '@/lib/permissionCenter'
import { usePermissionStore } from '@/stores/permission'
import type { PermissionCenterModel, PermissionCenterRole } from '@/types/permissionCenter'
import AssigneePickerModal, { type AssigneeKind } from '@/components/permission-center/AssigneePickerModal'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props {
  actor: string
  model: PermissionCenterModel
  role: PermissionCenterRole
  conditionDirty: boolean
  onDirtyChange: (dirty: boolean) => void
}

export default function RoleAssignees({ actor, model, role, conditionDirty, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<{ kind: AssigneeKind; values: string[] } | null>(null)
  const [error, setError] = useState('')
  const conditionDirtyRef = useRef(conditionDirty)
  conditionDirtyRef.current = conditionDirty
  const isSuperRole = role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const close = () => { setDraft(null); setError(''); onDirtyChange(false) }
  const open = (kind: AssigneeKind) => { setError(''); setDraft({ kind, values: [...(kind === 'users' ? role.members : role.departments)] }) }
  const confirm = () => {
    if (!draft) return
    if (conditionDirtyRef.current) { setError('请先完成筛选条件，或明确切换为全部数据，再调整授权范围。当前继续使用上次已生效配置。'); return }
    const store = usePermissionStore.getState()
    const latest = store.permissionCenter?.roles.find(item => item.id === role.id)
    if (!latest) { setError('此角色已不存在，请取消后重新选择角色。'); return }
    const users = draft.kind === 'users' ? draft.values : latest.members
    const departments = draft.kind === 'departments' ? draft.values : latest.departments
    const result = isSuperRole ? store.setSuperAdminMembers(actor, users) : store.setCenterRoleAssignees(actor, role.id, { users, departments })
    if (result.ok) close()
    else setError(result.error)
  }
  return <section className={styles.assignees} aria-label="角色人员配置">
    <div className={styles.memberFields}>
      {(['users', 'departments'] as const).map(kind => {
        const label = kind === 'users' ? '授权人员' : '授权部门'
        const values = kind === 'users' ? role.members : role.departments
        return <div className={styles.memberField} key={kind}>
          <span className={styles.memberLabel}>{label}</span>
          <div className={styles.memberValues} aria-label={label}>
            {values.length ? values.map(value => <Tag key={value}>{value}</Tag>)
              : <span className={styles.muted}>{isSuperRole && kind === 'departments' ? '系统超级管理员按人员授权' : `未配置${kind === 'users' ? '人员' : '部门'}`}</span>}
          </div>
          <Button aria-label={`配置${label}`} disabled={conditionDirty || (isSuperRole && (kind === 'departments' || !isPermissionCenterAdmin(model, actor)))} onClick={() => open(kind)}>配置</Button>
        </div>
      })}
    </div>
    <div className={styles.muted}>{isSuperRole ? '系统超级管理员拥有全部菜单及操作权限，至少保留一位人员。' : '角色成员在所有已授权菜单中生效；未授予菜单功能时仍无法访问。'}</div>
    {draft && <AssigneePickerModal kind={draft.kind} values={draft.values} error={error} disabled={conditionDirty} onCancel={close} onConfirm={confirm}
      onChange={values => {
        setDraft({ ...draft, values }); setError('')
        const saved = draft.kind === 'users' ? role.members : role.departments
        onDirtyChange(values.length !== saved.length || values.some(value => !saved.includes(value)))
      }} />}
  </section>
}
