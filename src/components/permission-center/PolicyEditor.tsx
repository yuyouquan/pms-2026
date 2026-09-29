'use client'

import { useCallback, useRef, useState } from 'react'
import { Alert, Button } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { createEmptyMenuPolicy, validateMenuPolicy } from '@/lib/permissionCenter'
import { getProjectDataPolicy } from '@/lib/projectPermissionScope'
import { usePermissionStore } from '@/stores/permission'
import type { MenuPolicy, PermissionCenterModel, PermissionCenterRole, PermissionMenu, PermissionMutationResult, ProjectDataScope } from '@/types/permissionCenter'
import DataPolicyEditor from '@/components/permission-center/DataPolicyEditor'
import styles from '@/components/permission-center/PermissionCenter.module.css'

interface Props { actor: string; model: PermissionCenterModel; role: PermissionCenterRole; menu: PermissionMenu; projectScope?: ProjectDataScope; onDirtyChange: (dirty: boolean) => void }

/** Data rules live here; role assignees and functional actions are edited in their own panels. */
export default function PolicyEditor({ actor, model, role, menu, projectScope, onDirtyChange }: Props) {
  const [error, setError] = useState('')
  const [conditionDraftPending, setConditionDraftPending] = useState(false)
  const conditionDraftPendingRef = useRef(false)
  const retry = useRef<(() => PermissionMutationResult) | null>(null)
  const conditionDraftMessage = '请先完成筛选条件，或明确切换为全部数据，再调整可见列。当前继续使用上次已生效配置。'
  const handleConditionDirtyChange = useCallback((dirty: boolean) => {
    conditionDraftPendingRef.current = dirty
    setConditionDraftPending(dirty)
    onDirtyChange(dirty)
  }, [onDirtyChange])
  const storedPolicy = model.policies.find(policy => policy.roleId === role.id && policy.menuId === menu.id)
  const scopedPolicy = storedPolicy ? getProjectDataPolicy(storedPolicy, projectScope) : undefined
  let validStored = false
  try { validStored = !!storedPolicy && !!scopedPolicy && validateMenuPolicy(storedPolicy).ok && validateMenuPolicy(scopedPolicy, projectScope).ok } catch { /* Invalid policies cannot grant. */ }
  const policy = validStored ? scopedPolicy! : createEmptyMenuPolicy(role.id, menu.id)
  const isSuperRole = role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin'
  const displayPolicy: MenuPolicy = isSuperRole ? { ...policy, actions: [...menu.actions], data: { mode: 'all', conjunction: 'all', conditions: [] }, columns: { mode: 'all', fields: [] } } : policy
  const mutate = (action: () => PermissionMutationResult) => {
    const result = action()
    setError(result.ok ? '' : result.error)
    retry.current = result.ok ? null : action
    return result
  }
  const updatePolicy = (update: (previous: MenuPolicy) => MenuPolicy, isDataUpdate = false) => mutate(() => {
    if (conditionDraftPendingRef.current && !isDataUpdate) return { ok: false, error: conditionDraftMessage }
    return usePermissionStore.getState().updateMenuPolicy(actor, role.id, menu.id, previous => {
      const effective = getProjectDataPolicy(previous, projectScope)
      let valid = false
      try { valid = validateMenuPolicy(previous).ok && validateMenuPolicy(effective, projectScope).ok } catch { /* Repair starts from a deny data policy. */ }
      const updated = update(valid ? effective : { ...createEmptyMenuPolicy(role.id, menu.id), actions: previous.actions })
      if (menu.id === 'project.view' && projectScope) return {
        ...previous,
        projectScopes: { ...previous.projectScopes, [projectScope]: { data: updated.data, columns: updated.columns } },
      }
      return { ...previous, data: updated.data, columns: updated.columns }
    })
  })
  return <>
    <div className={styles.menuHeader}><span className={styles.menuTitle}>{menu.label}</span><span className={styles.muted} role="status"><CheckCircleOutlined /> {error ? '自动保存失败' : '已自动保存'}</span></div>
    {error && <Alert className={styles.alert} type="error" showIcon message={error} action={<Button onClick={() => { if (retry.current) mutate(retry.current) }}>重试</Button>} />}
    {storedPolicy && !validStored && <Alert className={styles.alert} type="warning" showIcon message="此菜单的存储策略无效，当前不授予访问。请重新配置。" />}
    {conditionDraftPending && <Alert id="permission-condition-draft-block" className={styles.alert} type="warning" showIcon role="status" message={conditionDraftMessage} />}
    <DataPolicyEditor policy={displayPolicy} projectScope={projectScope} disabled={isSuperRole} columnsDisabled={conditionDraftPending}
      onUpdate={update => updatePolicy(update, true)} onColumnsUpdate={updatePolicy} onDirtyChange={handleConditionDirtyChange} />
    {isSuperRole && projectScope !== 'capability' && <div className={styles.muted}>系统超级管理员始终可查看全部数据和列。</div>}
  </>
}
