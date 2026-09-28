'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Select } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { PERMISSION_ACTION_LABELS, PERMISSION_DEPARTMENTS, PERMISSION_USERS, PERMISSION_USER_DEPARTMENTS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { createEmptyMenuPolicy, isPermissionCenterAdmin, validateMenuPolicy } from '@/lib/permissionCenter'
import { usePermissionStore } from '@/stores/permission'
import type { MenuPolicy, PermissionCenterModel, PermissionCenterRole, PermissionMenu, PermissionMutationResult } from '@/types/permissionCenter'
import DataPolicyEditor from '@/components/permission-center/DataPolicyEditor'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { actor: string; model: PermissionCenterModel; role: PermissionCenterRole; menu: PermissionMenu; onDirtyChange: (dirty: boolean) => void }
export default function PolicyEditor({ actor, model, role, menu, onDirtyChange }: Props) {
  const memberFieldId = useId()
  const [error, setError] = useState('')
  const [conditionDraftPending, setConditionDraftPending] = useState(false)
  const conditionDraftPendingRef = useRef(false)
  const conditionDraftMessage = '请先完成筛选条件，或明确切换为全部数据，再调整人员、功能权限和可见列。当前继续使用上次已生效配置。'
  const handleConditionDirtyChange = useCallback((dirty: boolean) => {
    // Update the submission guard synchronously, including events before React rerenders.
    conditionDraftPendingRef.current = dirty
    setConditionDraftPending(dirty)
    onDirtyChange(dirty)
  }, [onDirtyChange])
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const isSuperRole = role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const storedPolicy = model.policies.find(policy => policy.roleId === role.id && policy.menuId === menu.id)
  let validStored = false
  try { validStored = !!storedPolicy && validateMenuPolicy(storedPolicy).ok } catch { /* Malformed policies remain fail-closed. */ }
  const policy = validStored ? storedPolicy! : createEmptyMenuPolicy(role.id, menu.id)
  const displayPolicy: MenuPolicy = isSuperRole ? { ...policy, actions: [...menu.actions], data: { mode: 'all', conjunction: 'all', conditions: [] }, columns: { mode: 'all', fields: [] } } : policy
  const mutate = (action: () => PermissionMutationResult) => {
    const result = action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
    return result
  }
  const updatePolicy = (update: (previous: MenuPolicy) => MenuPolicy, isDataUpdate = false) => mutate(() => {
    // The guard is inside the retryable action so an older retry cannot bypass a new draft.
    if (conditionDraftPendingRef.current && !isDataUpdate) return { ok: false, error: conditionDraftMessage }
    return usePermissionStore.getState().updateMenuPolicy(actor, role.id, menu.id, previous => {
      let valid = false
      try { valid = validateMenuPolicy(previous).ok } catch { /* Explicit edits start from an empty policy when corrupt. */ }
      return update(valid ? previous : createEmptyMenuPolicy(role.id, menu.id))
    })
  })
  const userOptions = PERMISSION_USERS.map(user => ({ value: user, label: user, search: `${user} ${(PERMISSION_USER_DEPARTMENTS[user] ?? []).join(' ')}` }))
  const departmentOptions = PERMISSION_DEPARTMENTS.map(department => ({ value: department, label: department }))
  return <>
    <div className={styles.menuHeader}><span className={styles.menuTitle}>{menu.label}</span><span className={styles.muted} role="status"><CheckCircleOutlined /> {error ? '自动保存失败' : '已自动保存'}</span></div>
    {error && <Alert style={{ marginBottom: 12 }} type="error" showIcon message={error} action={<Button onClick={() => { if (retry.current) mutate(retry.current) }}>重试</Button>} />}
    {storedPolicy && !validStored && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="此菜单的存储策略无效，当前不授予访问。请重新配置。" />}
    {conditionDraftPending && <Alert id="permission-condition-draft-block" style={{ marginBottom: 12 }} type="warning" showIcon role="status" message={conditionDraftMessage} />}
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>人员配置</h3>
      <div className={styles.memberFields}>
        <div className={styles.memberField}>
          <label className={styles.memberLabel} htmlFor={`${memberFieldId}-users`}>授权人员</label>
          <Select id={`${memberFieldId}-users`} className={styles.memberSelect} aria-label="授权人员"
            aria-describedby={conditionDraftPending ? 'permission-condition-draft-block' : undefined}
            disabled={isSuperRole ? !isPermissionCenterAdmin(model, actor) : conditionDraftPending}
            mode="multiple" showSearch placeholder="搜索并选择人员"
            value={isSuperRole ? role.members : policy.users} options={userOptions}
            filterOption={(input, option) => String(option?.search ?? option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            onChange={users => isSuperRole
              ? mutate(() => usePermissionStore.getState().setSuperAdminMembers(actor, users))
              : updatePolicy(previous => ({ ...previous, users }))} />
        </div>
        <div className={styles.memberField}>
          <label className={styles.memberLabel} htmlFor={`${memberFieldId}-departments`}>授权部门</label>
          <Select id={`${memberFieldId}-departments`} className={styles.memberSelect} aria-label="授权部门"
            aria-describedby={conditionDraftPending ? 'permission-condition-draft-block' : undefined}
            disabled={isSuperRole || conditionDraftPending} mode="multiple" showSearch optionFilterProp="label"
            placeholder={isSuperRole ? '系统超级管理员按人员授权' : '搜索并选择部门'}
            value={isSuperRole ? [] : policy.departments} options={departmentOptions}
            onChange={departments => updatePolicy(previous => ({ ...previous, departments }))} />
        </div>
      </div>
      <div className={styles.muted}>{isSuperRole
        ? '角色成员拥有全部菜单及操作权限；至少保留一位超级管理员。'
        : '仅对当前角色的当前菜单生效。未配置人员或部门时，不授予任何人权限。'}</div>
    </section>
    <section className={styles.section}><h3 className={styles.sectionTitle}>功能权限</h3>
      <div className={styles.actions} aria-describedby={conditionDraftPending ? 'permission-condition-draft-block' : undefined}>{menu.actions.map(action => <Checkbox key={action} checked={displayPolicy.actions.includes(action)} disabled={isSuperRole || conditionDraftPending}
        onChange={event => updatePolicy(previous => ({ ...previous, actions: event.target.checked ? [...new Set([...previous.actions, action])] : previous.actions.filter(item => item !== action) }))}>
        {PERMISSION_ACTION_LABELS[action]}
      </Checkbox>)}</div>
      {isSuperRole && <div className={styles.muted}>系统超级管理员始终拥有全部权限，菜单权限不可单独取消。</div>}
    </section>
    <DataPolicyEditor policy={displayPolicy} disabled={isSuperRole} columnsDisabled={conditionDraftPending}
      onUpdate={update => updatePolicy(update, true)} onColumnsUpdate={updatePolicy} onDirtyChange={handleConditionDirtyChange} />
  </>
}
