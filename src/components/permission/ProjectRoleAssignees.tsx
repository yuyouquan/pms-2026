'use client'

import { useState } from 'react'
import { Button, Tag } from 'antd'
import AssigneePickerModal, { type AssigneeKind } from '@/components/permission-center/AssigneePickerModal'
import type { Role } from '@/stores/permission'
import type { PermissionMutationResult } from '@/types/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props {
  role: Role
  memberSource?: string
  disabled?: boolean
  onCommit: (kind: AssigneeKind, values: string[]) => PermissionMutationResult
  onDirtyChange: (dirty: boolean) => void
}

export default function ProjectRoleAssignees({ role, memberSource, disabled = false, onCommit, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<{ kind: AssigneeKind; values: string[] } | null>(null)
  const [error, setError] = useState('')
  const close = () => { setDraft(null); setError(''); onDirtyChange(false) }
  return <section className={styles.assignees} aria-label="项目角色人员配置">
    <div className={styles.memberFields}>{(['users', 'departments'] as const).map(kind => {
      const label = kind === 'users' ? '授权人员' : '授权部门'
      const values = kind === 'users' ? role.members : role.departments ?? []
      return <div className={styles.memberField} key={kind}>
        <span className={styles.memberLabel}>{label}</span>
        <div><div className={styles.memberValues} aria-label={label}>
          {values.length ? values.map(value => <Tag key={value}>{value}</Tag>) : <span className={styles.muted}>未配置{kind === 'users' ? '人员' : '部门'}</span>}
        </div>{kind === 'users' && memberSource && <div className={styles.muted}>{memberSource}</div>}</div>
        <Button aria-label={`配置${label}`} disabled={disabled || (kind === 'users' && !!memberSource)} onClick={() => { if (disabled) return; setError(''); setDraft({ kind, values: [...values] }) }}>配置</Button>
      </div>
    })}</div>
    <div className={styles.muted}>授权人员与部门直属成员继承该角色的功能权限，仅在当前项目生效。部门授权不改变项目团队职责。</div>
    {draft && <AssigneePickerModal kind={draft.kind} values={draft.values} error={error} disabled={disabled} onCancel={close}
      onChange={values => {
        setDraft({ ...draft, values }); setError('')
        const saved = draft.kind === 'users' ? role.members : role.departments ?? []
        onDirtyChange(values.length !== saved.length || values.some(value => !saved.includes(value)))
      }} onConfirm={() => {
        if (disabled) { setError('当前无权限配置人员'); return }
        const result = onCommit(draft.kind, draft.values)
        if (result.ok) close()
        else setError(result.error)
      }} />}
  </section>
}
