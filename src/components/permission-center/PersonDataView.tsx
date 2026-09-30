'use client'

import { Empty, Tag } from 'antd'
import { getPermissionColumnFields, getPermissionFields, PERMISSION_USER_DEPARTMENTS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { isRoleAssignedToUser, validateMenuPolicy } from '@/lib/permissionCenter'
import { getPermissionColumnUnits, getPermissionColumnUnitState, getSelectedPermissionColumns } from '@/lib/permissionColumnUnits'
import { getProjectDataPolicy } from '@/lib/projectPermissionScope'
import type { MenuPolicy, PermissionCenterModel, PermissionCenterRole, PermissionMenu, ProjectDataScope } from '@/types/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'

const operatorLabels: Record<string, string> = {
  eq: '等于', neq: '不等于', contains: '包含', notContains: '不包含', in: '属于', notIn: '不属于',
  empty: '为空', notEmpty: '不为空', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于',
}
interface Props { model: PermissionCenterModel; person: string; menu: PermissionMenu; projectScope?: ProjectDataScope }

export default function PersonDataView({ model, person, menu, projectScope }: Props) {
  const assigned = model.roles.filter(role => isRoleAssignedToUser(role, person))
  const filterFields = getPermissionFields(menu.id)
  const columnFields = getPermissionColumnFields(menu.id, projectScope)
  const grants = assigned.flatMap<{ role: PermissionCenterRole; policy: MenuPolicy | null }>(role => {
    if (role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin') return [{ role, policy: null }]
    const storedPolicy = model.policies.find(item => item.roleId === role.id && item.menuId === menu.id)
    if (!storedPolicy) return []
    const policy = getProjectDataPolicy(storedPolicy, projectScope)
    try { return validateMenuPolicy(storedPolicy).ok && validateMenuPolicy(policy, projectScope).ok && policy.actions.includes('view') ? [{ role, policy }] : [] } catch { return [] }
  })
  return <div className={styles.personData}>
    <div className={styles.menuHeader}><span className={styles.menuTitle}>{menu.label}</span><span className={styles.muted}>只读</span></div>
    {projectScope === 'capability' ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可配置列" /> : <>
    <div className={styles.muted}>多个角色的授权按角色取并集；每个角色的筛选条件与可见列保持成组生效，不跨角色组合。</div>
    {grants.length ? grants.map(({ role, policy }) => {
      const provenance = role.members.includes(person) ? '直接授权' : '部门授权：' + (role.departments ?? []).filter(department => PERMISSION_USER_DEPARTMENTS[person]?.includes(department)).join('、')
      const selectedColumns = policy ? getSelectedPermissionColumns(menu.id, policy.columns, projectScope) : []
      const columnLabels = getPermissionColumnUnits(menu.id, projectScope).flatMap(unit => {
        const state = getPermissionColumnUnitState(unit, selectedColumns)
        return state.selectedCount ? [`${unit.label}${state.indeterminate ? '（部分）' : ''}`] : []
      })
      const columns = !columnFields.length ? '暂无可配置列' : !policy || policy.columns.mode === 'all' ? '全部列' : columnLabels.join('、') || '暂无可见列'
      return <section className={styles.sourcePolicy} key={role.id}>
        <div className={styles.sourceHeading}><strong>{role.name}</strong><Tag>{provenance}</Tag></div>
        <div className={styles.sourceLine}><span>可见数据</span><strong>{!policy || policy.data.mode === 'all' ? '全部数据' : policy.data.conjunction === 'all' ? '满足所有条件' : '满足任一条件'}</strong></div>
        {policy?.data.mode === 'conditions' && <div className={styles.chips} aria-label={role.name + '已生效筛选条件'}>{policy.data.conditions.map(condition => {
          const field = filterFields.find(item => item.key === condition.field)
          const value = Array.isArray(condition.value) ? condition.value.join('、') : String(condition.value ?? '')
          return <span className="pms-active-filter-chip" key={condition.id}><span className="pms-active-filter-chip__content">
            <span className="pms-active-filter-chip__field">{field?.label ?? condition.field}</span>
            <span className="pms-active-filter-chip__operator">{operatorLabels[condition.operator] ?? condition.operator}</span>
            {!['empty', 'notEmpty'].includes(condition.operator) && <span className="pms-active-filter-chip__value">{value}</span>}
          </span></span>
        })}</div>}
        <div className={styles.sourceLine}><span>可见列</span><strong>{columns}</strong></div>
      </section>
    }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={projectScope ? '此人员没有该项目类型的数据授权' : '此人员没有该菜单的数据授权'} />}</>}
  </div>
}
