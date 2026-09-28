'use client'

import { useCallback, useEffect, useMemo, useState, type Key } from 'react'
import { Button, Empty, Input, Modal, Space, Tabs, Tag, Tooltip, Tree, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { CollapsibleSidebarShell } from '@/components/shared/CollapsibleWorkspace'
import RoleForm from '@/components/permission-center/RoleForm'
import ProjectRoleAssignees from '@/components/permission/ProjectRoleAssignees'
import ProjectFunctionalPermissions from '@/components/permission/ProjectFunctionalPermissions'
import { getProjectPermissionCatalog } from '@/components/permission/projectPermissionCatalog'
import { PROJECT_CATEGORY_MACHINE, PROJECT_CATEGORY_TECH, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { hasPermission, usePermissionStore, type Role } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { ProjectItem } from '@/types/app'
import type { PermissionCenterModel, PermissionMutationResult } from '@/types/permissionCenter'
import shared from '@/components/permission-center/PermissionCenter.module.css'
import styles from '@/components/permission/ProjectPermissionConfig.module.css'

export interface ProjectPermissionConfigProps { project: ProjectItem; projectId: string; actor: string }
const groupName = (role: Role) => role.groupName || (role.isFixed ? '项目角色' : '自定义角色')
const groupKey = (name: string) => `group:${encodeURIComponent(name)}`
const roleKey = (name: string) => `role:${encodeURIComponent(name)}`

export default function ProjectPermissionConfig({ project, projectId, actor }: ProjectPermissionConfigProps) {
  const store = usePermissionStore()
  const roles = store.rolesByProject[projectId] ?? []
  const [selectedName, setSelectedName] = useState(roles[0]?.name ?? '')
  const [tab, setTab] = useState('assignees')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [expanded, setExpanded] = useState<Key[]>(() => [...new Set(roles.map(role => groupKey(groupName(role))))])
  const [formRole, setFormRole] = useState<Role | 'new' | null>(null)
  const [epoch, setEpoch] = useState(0)
  const setDraft = useUiStore(state => state.setPermissionCenterHasDraft)
  const onDirty = useCallback((dirty: boolean) => setDraft(dirty), [setDraft])
  useEffect(() => () => setDraft(false), [setDraft])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const adapt = () => { setNarrow(media.matches); if (media.matches) setCollapsed(true) }
    adapt(); media.addEventListener('change', adapt)
    return () => media.removeEventListener('change', adapt)
  }, [])
  const role = roles.find(item => item.name === selectedName) ?? roles[0]
  const model: PermissionCenterModel = useMemo(() => ({
    version: 2, policies: [],
    groups: [...new Set(roles.map(groupName))].map(name => ({ id: groupKey(name), name })),
    roles: roles.map(item => ({ id: item.name, groupId: groupKey(groupName(item)), name: item.name, description: item.description ?? '', members: item.members, departments: item.departments ?? [] })),
  }), [roles])
  const sessionError = (): PermissionMutationResult | undefined => {
    const session = useProjectStore.getState()
    if (session.currentLoginUser !== actor || session.selectedProject?.id !== project.id) return { ok: false, error: '当前用户或项目已变化，请重新打开配置。' }
    if (!hasPermission(actor, projectId, 'projectPermission:manageRoles')) return { ok: false, error: '无权限修改项目角色' }
  }
  const navigate = (action: () => void) => useUiStore.getState().navigateWithEditGuard(() => {
    setDraft(false); setFormRole(null); setEpoch(value => value + 1); action()
  }, false)
  const title = (value: string) => <Tooltip title={value} placement="right"><span className={shared.node}>{value}</span></Tooltip>
  const roleTree: DataNode[] = model.groups.flatMap(group => {
    const matched = roles.filter(item => groupKey(groupName(item)) === group.id && `${group.name} ${item.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    return matched.length ? [{ key: group.id, title: title(group.name), selectable: false, children: matched.map(item => ({ key: roleKey(item.name), title: title(item.name), isLeaf: true })) }] : []
  })
  const memberSource = role?.isFixed && project.type === PROJECT_CATEGORY_TECH ? '授权人员随项目团队同步，请在项目团队信息中维护。'
    : role?.isFixed && project.type === PROJECT_CATEGORY_MACHINE && role.name === 'SPM' ? '授权人员随 SPM 同步，请在项目基础信息中维护。' : undefined
  const deleteRole = () => {
    if (!role || role.isFixed) return
    navigate(() => Modal.confirm({ title: `删除角色“${role.name}”？`, content: '删除后将立即撤销此角色的项目权限。', okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => {
        const result = sessionError() ?? usePermissionStore.getState().deleteProjectRole(actor, projectId, role.name)
        if (!result.ok) { message.error(result.error); return Promise.reject(new Error(result.error)) }
        setSelectedName(usePermissionStore.getState().rolesByProject[projectId]?.[0]?.name ?? '')
      },
    }))
  }
  return <section className={styles.workspace} aria-label="项目权限配置">
    <Button className={styles.mobileRoleToggle} onClick={() => setCollapsed(value => !value)}>角色</Button>
    <CollapsibleSidebarShell className={shared.sidebar} collapsed={collapsed} onCollapsedChange={setCollapsed} title={null} ariaLabel="项目角色"
      expandedWidth={180} collapsedWidth={40} expandLabel="展开项目角色侧栏" collapseLabel="收起项目角色侧栏">
      <Input className={shared.search} prefix={<SearchOutlined />} placeholder="搜索角色" aria-label="搜索项目角色" value={search} onChange={event => setSearch(event.target.value)} allowClear />
      <Button className={shared.addRole} icon={<PlusOutlined />} onClick={() => navigate(() => setFormRole('new'))}>添加角色</Button>
      {roleTree.length ? <Tree blockNode treeData={roleTree} selectedKeys={role ? [roleKey(role.name)] : []} expandedKeys={search ? roleTree.map(node => node.key) : expanded}
        onExpand={setExpanded} onClick={(_, node) => { if (!node.isLeaf) setExpanded(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key]) }}
        onSelect={keys => { const selected = roles.find(item => roleKey(item.name) === keys[0]); if (selected) navigate(() => { setSelectedName(selected.name); if (narrow) setCollapsed(true) }) }} />
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到角色" />}
    </CollapsibleSidebarShell>
    <div className={`${shared.content} ${styles.content}`}>
      {role ? <>
        <div className={shared.roleHeader}><div className={shared.roleCopy}>
          <div className={shared.roleTitle}>{role.name} {role.isFixed && <Tag>固定角色</Tag>}</div>
          <div className={shared.muted}>{groupName(role)}</div>
          {role.description && <div className={`${shared.muted} ${shared.description}`}>{role.description}</div>}
        </div>{!role.isFixed && <Space><Button icon={<EditOutlined />} onClick={() => navigate(() => setFormRole(role))}>编辑</Button><Button danger icon={<DeleteOutlined />} onClick={deleteRole}>删除</Button></Space>}</div>
        <Tabs className={shared.contentTabs} activeKey={tab} onChange={key => navigate(() => setTab(key))} items={[{ key: 'assignees', label: '人员配置' }, { key: 'functional', label: '功能权限' }]} />
        {tab === 'assignees' ? <ProjectRoleAssignees key={`${role.name}:${epoch}`} role={role} memberSource={memberSource} onDirtyChange={onDirty} onCommit={(kind, values) => {
          const error = sessionError(); if (error) return error
          const latest = usePermissionStore.getState()
          const currentRole = latest.rolesByProject[projectId]?.find(item => item.name === role.name)
          if (!currentRole) return { ok: false, error: '此角色已不存在，请重新选择角色。' }
          if (kind === 'departments') return latest.setProjectRoleDepartments(actor, projectId, role.name, values)
          if (memberSource) return { ok: false, error: memberSource }
          const success = project.type === PROJECT_TYPE_TOS_VERSION && currentRole.isFixed
            ? useProjectStore.getState().syncTosTeamPermissionMembersGuarded(projectId, actor, role.name, values)
            : latest.setRolesForProjectGuarded(projectId, actor, previous => previous.map(item => item.name === role.name ? { ...item, members: values } : item))
          return success ? { ok: true } : { ok: false, error: '人员配置失败，请确认当前项目与权限后重试。' }
        }} /> : <ProjectFunctionalPermissions key={role.name} project={project} grants={store.rolePermissionsByProject[projectId]?.[role.name] ?? {}} disabled={false}
          onChange={(key, enabled) => {
            const error = sessionError(); if (error && !error.ok) { message.error(error.error); return }
            if (!getProjectPermissionCatalog(project).some(group => group.rows.some(row => row.actions.some(action => action.key === key)))) return
            const latest = usePermissionStore.getState()
            if (!latest.rolesByProject[projectId]?.some(item => item.name === role.name)) { message.error('此角色已不存在'); return }
            if (!latest.setRolePermissionsForProjectGuarded(projectId, actor, previous => ({ ...previous, [role.name]: { ...previous[role.name], [key]: enabled } }))) message.error('无权限修改项目角色')
          }} />}
      </> : <Empty description="暂无角色，请先添加角色" />}
    </div>
    {formRole && <RoleForm model={model} role={formRole === 'new' ? undefined : model.roles.find(item => item.name === formRole.name)} onDirty={() => setDraft(true)} onClose={() => navigate(() => setFormRole(null))}
      hint={formRole === 'new' ? '新角色默认可查看资源、维护各部门人力投入和非人力投入，可在功能权限中调整。' : undefined}
      onSubmit={input => {
        const error = sessionError(); if (error) return error
        const latest = usePermissionStore.getState()
        const result = formRole === 'new' ? latest.createProjectRole(actor, projectId, input) : latest.updateProjectRole(actor, projectId, formRole.name, input)
        if (result.ok) {
          setDraft(false); setFormRole(null); setSearch(''); setSelectedName(result.roleId ?? input.name.trim()); setExpanded(previous => [...new Set([...previous, groupKey(input.groupName.trim())])])
          setCollapsed(narrow)
        }
        return result
      }} />}
  </section>
}
