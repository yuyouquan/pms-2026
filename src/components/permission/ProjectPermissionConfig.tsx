'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react'
import { Alert, Button, Empty, Input, Modal, Space, Tabs, Tag, Tooltip, Tree, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { CollapsibleSidebarShell } from '@/components/shared/CollapsibleWorkspace'
import RoleForm from '@/components/permission-center/RoleForm'
import ProjectRoleAssignees from '@/components/permission/ProjectRoleAssignees'
import ProjectTeamMembers from '@/components/permission/ProjectTeamMembers'
import ProjectFunctionalPermissions from '@/components/permission/ProjectFunctionalPermissions'
import { getProjectPermissionCatalog } from '@/components/permission/projectPermissionCatalog'
import { projectTeamScopeToken } from '@/lib/projectTeamMutationGuard'
import { hasPermission, usePermissionStore, type Role } from '@/stores/permission'
import { useSyncedProjectRoles, getSyncedProjectRoles } from '@/stores/rolePermissionTemplates'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { ProjectItem } from '@/types/app'
import type { PermissionCenterModel, PermissionMutationResult } from '@/types/permissionCenter'
import shared from '@/components/permission-center/PermissionCenter.module.css'
import styles from '@/components/permission/ProjectPermissionConfig.module.css'

export interface ProjectPermissionConfigProps { project: ProjectItem; projectId: string; actor: string }
const groupName = (role: Role) => role.groupName || '自定义角色'
const groupKey = (name: string) => `group:${encodeURIComponent(name)}`
const localKey = (name: string) => `local:${encodeURIComponent(name)}`
const sourceKey = (id: string) => `ipm:${encodeURIComponent(id)}`

export default function ProjectPermissionConfig({ project, projectId, actor }: ProjectPermissionConfigProps) {
  const store = usePermissionStore()
  const roles = store.rolesByProject[projectId] ?? []
  const sourceRoles = useSyncedProjectRoles(projectId)
  const [selectedKey, setSelectedKey] = useState(() => sourceRoles[0] ? sourceKey(sourceRoles[0].id) : localKey(roles[0]?.name ?? ''))
  const [tab, setTab] = useState('functional')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [expanded, setExpanded] = useState<Key[]>(() => ['source', 'local', ...[...new Set(roles.map(groupName))].map(groupKey)])
  const [formRole, setFormRole] = useState<Role | 'new' | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [error, setError] = useState('')
  const retry = useRef<{ key: string; action: () => PermissionMutationResult } | null>(null)
  const currentKey = sourceRoles.some(role => sourceKey(role.id) === selectedKey) || roles.some(role => localKey(role.name) === selectedKey)
    ? selectedKey : sourceRoles[0] ? sourceKey(sourceRoles[0].id) : localKey(roles[0]?.name ?? '')
  const currentKeyRef = useRef(currentKey)
  currentKeyRef.current = currentKey
  const sourceRole = sourceRoles.find(item => sourceKey(item.id) === currentKey)
  const role = roles.find(item => localKey(item.name) === currentKey)
  const displayName = sourceRole?.roleName || role?.name
  const target = sourceRole ? { source: 'ipm' as const, id: sourceRole.id } : role ? { source: 'local' as const, name: role.name } : null
  const canManage = hasPermission(actor, projectId, 'projectPermission:manageRoles')
  // Keep the authority context from the page opening. An already-open picker or
  // role form must not acquire a new source binding merely because React rerenders.
  const openingToken = useRef(projectTeamScopeToken(project.id)).current
  const setDraft = useUiStore(state => state.setPermissionCenterHasDraft)
  const onDirty = useCallback((dirty: boolean) => setDraft(dirty), [setDraft])
  useEffect(() => () => setDraft(false), [setDraft])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const adapt = () => { setNarrow(media.matches); if (media.matches) setCollapsed(true) }
    adapt(); media.addEventListener('change', adapt)
    return () => media.removeEventListener('change', adapt)
  }, [])
  const model: PermissionCenterModel = useMemo(() => ({
    version: 2, policies: [],
    groups: [...new Set(roles.map(groupName))].map(name => ({ id: groupKey(name), name })),
    roles: roles.map(item => ({ id: item.name, groupId: groupKey(groupName(item)), name: item.name, description: item.description ?? '', members: item.members, departments: item.departments ?? [] })),
  }), [roles])
  const sessionError = (key = currentKey): PermissionMutationResult | undefined => {
    const session = useProjectStore.getState()
    if (session.currentLoginUser !== actor || session.selectedProject?.id !== project.id || projectTeamScopeToken(project.id) !== openingToken || currentKeyRef.current !== key) return { ok: false, error: '当前用户、项目或角色已变化，请重新打开配置。' }
    if (!hasPermission(actor, projectId, 'projectPermission:manageRoles')) return { ok: false, error: '无权限修改项目角色' }
  }
  const mutate = (key: string, action: () => PermissionMutationResult) => {
    const result = sessionError(key) ?? action()
    retry.current = result.ok ? null : { key, action }
    if (!result.ok) { setError(result.error); message.error(result.error) } else setError('')
    return result
  }
  const navigate = (action: () => void) => useUiStore.getState().navigateWithEditGuard(() => {
    setDraft(false); setFormRole(null); setEpoch(value => value + 1); setError(''); action()
  }, false)
  const title = (value: string) => <Tooltip title={value} placement="right"><span className={shared.node}>{value}</span></Tooltip>
  const query = search.trim().toLocaleLowerCase()
  const sourceMatches = sourceRoles.filter(item => `${item.roleName} ${item.sourceRoleName} ${item.ipmRoleCode}`.toLocaleLowerCase().includes(query))
  const localMatches = roles.filter(item => `${groupName(item)} ${item.name}`.toLocaleLowerCase().includes(query))
  const roleTree: DataNode[] = [
    ...(sourceMatches.length ? [{ key: 'source', title: title('IPM 同步角色'), selectable: false, children: sourceMatches.map(item => ({ key: sourceKey(item.id), title: <Tooltip title={`IPM编码：${item.ipmRoleCode}`}><span className={shared.node}>{item.roleName} <Tag color="purple">来源</Tag></span></Tooltip>, isLeaf: true })) }] : []),
    ...(localMatches.length ? [{ key: 'local', title: title('本地角色'), selectable: false, children: [...new Set(localMatches.map(groupName))].map(name => ({ key: groupKey(name), title: title(name), selectable: false, children: localMatches.filter(item => groupName(item) === name).map(item => ({ key: localKey(item.name), title: title(item.name), isLeaf: true })) })) }] : []),
  ]
  const deleteRole = () => {
    if (!role || !canManage) return
    const key = currentKey
    navigate(() => Modal.confirm({ title: `删除角色“${role.name}”？`, content: '删除后将立即撤销此角色的项目权限。', okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => {
        const result = mutate(key, () => usePermissionStore.getState().deleteProjectRole(actor, projectId, role.name))
        if (!result.ok) return Promise.reject(new Error(result.error))
        setSelectedKey(sourceRoles[0] ? sourceKey(sourceRoles[0].id) : localKey(usePermissionStore.getState().rolesByProject[projectId]?.[0]?.name ?? ''))
        setTab('functional')
      },
    }))
  }
  const onGrants = (keys: string[], enabled: boolean) => {
    if (!target) return
    const allowed = new Set(getProjectPermissionCatalog(project).flatMap(group => group.rows.flatMap(row => row.actions.map(action => action.key))))
    if (keys.some(key => !allowed.has(key))) { setError('权限目标无效'); return }
    mutate(currentKey, () => {
      if (target.source === 'ipm' && !getSyncedProjectRoles(projectId).some(item => item.id === target.id)) return { ok: false, error: '来源角色已变化，请重新选择。' }
      return usePermissionStore.getState().toggleProjectRolePermissions(actor, projectId, target, keys, enabled)
    })
  }
  return <section className={styles.workspace} aria-label="团队与权限配置">
    <Button className={styles.mobileRoleToggle} onClick={() => setCollapsed(value => !value)}>角色</Button>
    <CollapsibleSidebarShell className={shared.sidebar} collapsed={collapsed} onCollapsedChange={setCollapsed} title={null} ariaLabel="项目角色" expandedWidth={180} collapsedWidth={40} expandLabel="展开项目角色侧栏" collapseLabel="收起项目角色侧栏">
      <Input className={shared.search} prefix={<SearchOutlined />} placeholder="搜索角色" aria-label="搜索项目角色" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      {canManage && <Button className={shared.addRole} icon={<PlusOutlined />} onClick={() => navigate(() => setFormRole('new'))}>添加角色</Button>}
      {roleTree.length ? <Tree blockNode treeData={roleTree} selectedKeys={displayName ? [currentKey] : []} expandedKeys={query ? roleTree.flatMap(node => [node.key, ...(node.children?.map(child => child.key) ?? [])]) : expanded} onExpand={setExpanded} onSelect={keys => { const next = String(keys[0] ?? ''); if (next) navigate(() => { setSelectedKey(next); setTab('functional'); if (narrow) setCollapsed(true) }) }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到角色" />}
    </CollapsibleSidebarShell>
    <div className={`${shared.content} ${styles.content}`}>
      {displayName ? <>
        <div className={shared.roleHeader}><div className={shared.roleCopy}>
          <div className={shared.roleTitle}>{displayName} {sourceRole && <Tag color="purple">IPM 同步</Tag>}</div>
          {sourceRole ? <div className={shared.muted}>IPM角色编码：{sourceRole.ipmRoleCode} · PMS角色编码：{sourceRole.pmsRoleCode || '未配置模板'} {sourceRole.templateId ? '' : '· 未配置模板'}</div> : <div className={shared.muted}>{groupName(role!)}</div>}
          {role?.description && <div className={`${shared.muted} ${shared.description}`}>{role.description}</div>}
        </div>{role && canManage && <Space><Button icon={<EditOutlined />} onClick={() => navigate(() => setFormRole(role))}>编辑</Button><Button danger icon={<DeleteOutlined />} onClick={deleteRole}>删除</Button></Space>}</div>
        {error && <Alert className={shared.alert} type="error" showIcon message={error} action={retry.current && <Button onClick={() => { if (retry.current) mutate(retry.current.key, retry.current.action) }}>重试</Button>} />}
        <Tabs className={shared.contentTabs} activeKey={tab} onChange={key => navigate(() => setTab(key))} items={[{ key: 'functional', label: '功能权限' }, { key: 'assignees', label: sourceRole ? '人员列表' : '人员配置' }]} />
        {tab === 'assignees' ? sourceRole ? <ProjectTeamMembers key={sourceRole.id} projectId={projectId} ipmRoleCode={sourceRole.ipmRoleCode} roleName={sourceRole.sourceRoleName} /> : role ? <ProjectRoleAssignees key={`${role.name}:${epoch}`} role={role} disabled={!canManage} onDirtyChange={onDirty} onCommit={(kind, values) => mutate(currentKey, () => {
          const latest = usePermissionStore.getState().rolesByProject[projectId]?.find(item => item.name === role.name)
          if (!latest) return { ok: false, error: '此角色已不存在，请重新选择角色。' }
          return usePermissionStore.getState().setProjectRoleAssignees(actor, projectId, role.name, { users: kind === 'users' ? values : latest.members, departments: kind === 'departments' ? values : latest.departments ?? [] })
        })} /> : null : <ProjectFunctionalPermissions key={currentKey} project={project} grants={sourceRole?.grants ?? store.rolePermissionsByProject[projectId]?.[role!.name] ?? {}} disabled={!canManage} onChange={(key, enabled) => onGrants([key], enabled)} onBulkChange={onGrants} />}
      </> : <Empty description="暂无角色，请先添加角色" />}
    </div>
    {formRole && canManage && <RoleForm model={model} role={formRole === 'new' ? undefined : model.roles.find(item => item.name === formRole.name)} onDirty={() => setDraft(true)} onClose={() => navigate(() => setFormRole(null))} hint={formRole === 'new' ? '新角色默认可查看资源，可在功能权限中调整。' : undefined} onSubmit={input => {
      const result = mutate(currentKey, () => formRole === 'new' ? usePermissionStore.getState().createProjectRole(actor, projectId, input) : usePermissionStore.getState().updateProjectRole(actor, projectId, formRole.name, input))
      if (result.ok) { setDraft(false); setFormRole(null); setSearch(''); setSelectedKey(localKey(result.roleId ?? input.name.trim())); setTab('functional'); setCollapsed(narrow) }
      return result
    }} />}
  </section>
}
