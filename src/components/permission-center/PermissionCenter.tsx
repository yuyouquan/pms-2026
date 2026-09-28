'use client'

import { useCallback, useEffect, useState, type Key } from 'react'
import { Button, Empty, Input, Modal, Segmented, Space, Tabs, Tag, Tooltip, Tree } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { getPermissionFields, PERMISSION_USER_DEPARTMENTS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { getAssignedPermissionUsers, isRoleAssignedToUser } from '@/lib/permissionCenter'
import { useMenuPermission, usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { CollapsibleSidebarShell } from '@/components/shared/CollapsibleWorkspace'
import type { PermissionCenterRole, PermissionMenuId } from '@/types/permissionCenter'
import PolicyEditor from '@/components/permission-center/PolicyEditor'
import RoleAssignees from '@/components/permission-center/RoleAssignees'
import RoleForm from '@/components/permission-center/RoleForm'
import FunctionalMatrix from '@/components/permission-center/FunctionalMatrix'
import PersonDataView from '@/components/permission-center/PersonDataView'
import { buildPermissionMenuTree, CONFIGURABLE_PERMISSION_MENUS, getMenuGroupKeys, type PermissionMenuNode } from '@/components/permission-center/menuTree'
import styles from '@/components/permission-center/PermissionCenter.module.css'

type ViewMode = 'role' | 'person'
type ContentTab = 'functional' | 'data'
const dataMenus = () => CONFIGURABLE_PERMISSION_MENUS.filter(menu => getPermissionFields(menu.id).length > 0)
const filterDataNodes = (nodes: PermissionMenuNode[]): PermissionMenuNode[] => nodes.flatMap(node => {
  if (node.isLeaf) return dataMenus().some(menu => menu.id === node.key) ? [node] : []
  const children = filterDataNodes(node.children ?? [])
  return children.length ? [{ ...node, children }] : []
})

export default function PermissionCenter() {
  const model = usePermissionStore(state => state.permissionCenter)
  const actor = useProjectStore(state => state.currentLoginUser)
  const permission = useMenuPermission(actor, 'permission.center')
  const [viewMode, setViewMode] = useState<ViewMode>('role')
  const [contentTab, setContentTab] = useState<ContentTab>('functional')
  const [roleId, setRoleId] = useState(SUPER_ADMIN_ROLE_ID)
  const [personName, setPersonName] = useState('')
  const [menuId, setMenuId] = useState<PermissionMenuId>('project.view')
  const [roleSearch, setRoleSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [roleCollapsed, setRoleCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [roleExpanded, setRoleExpanded] = useState<Key[]>(() => model?.groups.map(group => group.id) ?? [])
  const [menuExpanded, setMenuExpanded] = useState<Key[]>(() => getMenuGroupKeys(filterDataNodes(buildPermissionMenuTree())))
  const [formRole, setFormRole] = useState<PermissionCenterRole | 'new' | null>(null)
  const [conditionDirty, setConditionDirty] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const setDraft = useUiStore(state => state.setPermissionCenterHasDraft)
  const onConditionDirty = useCallback((dirty: boolean) => {
    setConditionDirty(dirty)
    setDraft(dirty || formDirty)
  }, [formDirty, setDraft])
  useEffect(() => { setDraft(conditionDirty || formDirty) }, [conditionDirty, formDirty, setDraft])
  useEffect(() => () => setDraft(false), [setDraft])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const adapt = () => { setNarrow(media.matches); if (media.matches) setRoleCollapsed(true) }
    adapt(); media.addEventListener('change', adapt)
    return () => media.removeEventListener('change', adapt)
  }, [])
  const role = model?.roles.find(item => item.id === roleId) ?? model?.roles[0]
  const assignedUsers = model ? getAssignedPermissionUsers(model) : []
  const person = assignedUsers.includes(personName) ? personName : assignedUsers[0]
  const menu = dataMenus().find(item => item.id === menuId)
  const navigate = (action: () => void) => useUiStore.getState().navigateWithEditGuard(() => {
    setConditionDirty(false); setFormDirty(false); setDraft(false); setEditorEpoch(value => value + 1); action()
  }, false)
  if (!model || !permission.can('manage')) return <Empty description="没有权限中心管理权限" />
  const title = (label: string) => <Tooltip title={label} placement="right"><span className={styles.node}>{label}</span></Tooltip>
  const roleTree: DataNode[] = model.groups.flatMap(group => {
    const roles = model.roles.filter(item => item.groupId === group.id && `${group.name} ${item.name}`.toLocaleLowerCase().includes(roleSearch.toLocaleLowerCase()))
    return roles.length ? [{ key: group.id, title: title(group.name), selectable: false, children: roles.map(item => ({ key: item.id, title: title(item.name), isLeaf: true })) }] : []
  })
  const menuNodes = filterDataNodes(buildPermissionMenuTree(menuSearch))
  const toTreeData = (nodes: PermissionMenuNode[]): DataNode[] => nodes.map(node => ({
    key: node.key, title: title(node.label), isLeaf: node.isLeaf, selectable: node.isLeaf,
    ...(node.children ? { children: toTreeData(node.children) } : {}),
  }))
  const closeForm = () => navigate(() => setFormRole(null))
  const deleteRole = () => {
    if (!role) return
    navigate(() => Modal.confirm({ title: `删除角色“${role.name}”？`, content: '删除后将立即撤销此角色的全部菜单授权。', okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        const result = usePermissionStore.getState().deleteCenterRole(actor, role.id)
        if (!result.ok) { Modal.error({ title: '删除失败', content: result.error }); return Promise.reject(new Error(result.error)) }
        const remaining = usePermissionStore.getState().permissionCenter?.roles ?? []
        setRoleId((remaining.find(item => item.groupId === role.groupId) ?? remaining[0])?.id ?? '')
      },
    }))
  }
  const personRoles = person ? model.roles.filter(item => isRoleAssignedToUser(item, person)) : []
  return <section className={styles.page} aria-label="权限中心">
    <div className="pms-project-management__view-mode"><Segmented<ViewMode> aria-label="权限中心视图" value={viewMode}
      onChange={value => navigate(() => { setViewMode(value); if (narrow) setRoleCollapsed(true) })}
      options={[{ value: 'role', label: '角色视图' }, { value: 'person', label: '人员视图' }]} /></div>
    <div className={styles.workspace}>
      <div className={styles.mobileSelectors}><Button aria-expanded={!roleCollapsed} onClick={() => setRoleCollapsed(value => !value)}>{viewMode === 'role' ? '选择角色' : '选择人员'}</Button></div>
      <CollapsibleSidebarShell className={styles.sidebar} collapsed={roleCollapsed} onCollapsedChange={setRoleCollapsed} title={null}
        ariaLabel={viewMode === 'role' ? '角色侧栏' : '人员侧栏'} expandedWidth={180} collapsedWidth={40}
        expandLabel="展开权限侧栏" collapseLabel="收起权限侧栏">
        {viewMode === 'role' ? <>
          <Input className={styles.search} prefix={<SearchOutlined />} placeholder="搜索角色" aria-label="搜索角色" value={roleSearch} onChange={event => setRoleSearch(event.target.value)} allowClear />
          <Button className={styles.addRole} icon={<PlusOutlined />} onClick={() => navigate(() => setFormRole('new'))}>添加角色</Button>
          {roleTree.length ? <Tree blockNode treeData={roleTree} selectedKeys={role ? [role.id] : []} expandedKeys={roleSearch ? roleTree.map(node => node.key) : roleExpanded}
            onClick={(_, node) => { if (!node.isLeaf) setRoleExpanded(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key]) }}
            onExpand={setRoleExpanded} onSelect={keys => { const selected = model.roles.find(item => item.id === keys[0]); if (selected) navigate(() => { setRoleId(selected.id); if (narrow) setRoleCollapsed(true) }) }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到角色" />}
        </> : <>
          <Input className={styles.search} prefix={<SearchOutlined />} placeholder="搜索已授权人员" aria-label="搜索已授权人员" value={personSearch} onChange={event => setPersonSearch(event.target.value)} allowClear />
          <div className={styles.personList} role="list" aria-label="已授权人员">{assignedUsers.filter(user => user.toLocaleLowerCase().includes(personSearch.toLocaleLowerCase())).map(user =>
            <button type="button" role="listitem" key={user} className={`${styles.personItem} ${user === person ? styles.personItemSelected : ''}`}
              aria-current={user === person ? 'true' : undefined} onClick={() => navigate(() => { setPersonName(user); if (narrow) setRoleCollapsed(true) })}>{user}</button>)}
          </div>
          {!assignedUsers.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已授权人员" />}
        </>}
      </CollapsibleSidebarShell>
      <div className={styles.content}>
        {viewMode === 'role' ? role ? <>
          <div className={styles.roleHeader}><div className={styles.roleCopy}><div className={styles.roleTitle}>{role.name}</div>
            <div className={styles.muted}>{model.groups.find(group => group.id === role.groupId)?.name}</div>
            {role.description && <div className={`${styles.muted} ${styles.description}`}>{role.description}</div>}
          </div>{role.id !== SUPER_ADMIN_ROLE_ID && <Space><Button icon={<EditOutlined />} onClick={() => navigate(() => setFormRole(role))}>编辑</Button><Button danger icon={<DeleteOutlined />} onClick={deleteRole}>删除</Button></Space>}</div>
          <RoleAssignees key={role.id} actor={actor} model={model} role={role} conditionDirty={conditionDirty} />
        </> : <Empty description="暂无角色，请先添加角色" /> : person ? <div className={styles.personHeader}>
          <div className={styles.roleTitle}>{person}</div>
          <div className={styles.muted}>只读有效权限 · {personRoles.length} 个来源角色</div>
          <div className={styles.personSources}>{personRoles.map(source => <Tag key={source.id}>{source.name} · {source.members.includes(person) ? '直接授权' : '部门授权：' + (source.departments ?? []).filter(department => PERMISSION_USER_DEPARTMENTS[person]?.includes(department)).join('、')}</Tag>)}</div>
        </div> : <Empty description="暂无已授权人员" />}
        {((viewMode === 'role' && role) || (viewMode === 'person' && person)) && <>
          <Tabs className={styles.contentTabs} activeKey={contentTab} onChange={key => navigate(() => setContentTab(key as ContentTab))}
            items={[{ key: 'functional', label: '功能权限' }, { key: 'data', label: '数据权限' }]} />
          {contentTab === 'functional'
            ? <FunctionalMatrix key={viewMode === 'role' ? role!.id : person} model={model} actor={actor}
                role={viewMode === 'role' ? role : undefined} person={viewMode === 'person' ? person : undefined} conditionDirty={conditionDirty} />
            : <div className={styles.configurationBody}>
                <nav className={styles.menuNavigation} aria-label="数据权限菜单">
                  <div className={styles.menuNavigationTitle}>数据菜单</div>
                  <Input className={styles.search} prefix={<SearchOutlined />} placeholder="搜索菜单" aria-label="搜索数据菜单" value={menuSearch} onChange={event => setMenuSearch(event.target.value)} allowClear />
                  <div className={styles.menuTree}>{menuNodes.length ? <Tree blockNode treeData={toTreeData(menuNodes)} selectedKeys={[menuId]}
                    expandedKeys={menuSearch.trim() ? getMenuGroupKeys(menuNodes) : menuExpanded}
                    onClick={(_, node) => { if (!node.isLeaf) setMenuExpanded(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key]) }}
                    onExpand={setMenuExpanded} onSelect={keys => { const selected = dataMenus().find(item => item.id === keys[0]); if (selected) navigate(() => setMenuId(selected.id)) }} />
                    : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到数据菜单" />}</div>
                </nav>
                <div className={styles.policyPane}>{menu
                  ? viewMode === 'role' && role
                    ? <PolicyEditor key={`${actor}:${role.id}:${menu.id}:${editorEpoch}`} actor={actor} model={model} role={role} menu={menu} onDirtyChange={onConditionDirty} />
                    : person ? <PersonDataView key={`${person}:${menu.id}`} model={model} person={person} menu={menu} /> : null
                  : <Empty description="请选择数据菜单" />}</div>
              </div>}
        </>}
      </div>
    </div>
    {formRole && <RoleForm model={model} role={formRole === 'new' ? undefined : formRole} onDirty={() => { setFormDirty(true); setDraft(true) }} onClose={closeForm}
      onSubmit={input => {
        const store = usePermissionStore.getState()
        const result = formRole === 'new' ? store.createCenterRole(actor, input) : store.updateCenterRole(actor, formRole.id, input)
        if (result.ok) {
          setFormDirty(false); setDraft(false); setFormRole(null); setRoleSearch(''); setRoleCollapsed(false)
          if (result.roleId) {
            setRoleId(result.roleId)
            const group = usePermissionStore.getState().permissionCenter?.roles.find(item => item.id === result.roleId)?.groupId
            if (group) setRoleExpanded(previous => [...new Set([...previous, group])])
          }
        }
        return result
      }} />}
  </section>
}
