'use client'

import { useCallback, useEffect, useState, type Key } from 'react'
import { Button, Empty, Input, Modal, Space, Tooltip, Tree } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { PERMISSION_MENUS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { useMenuPermission, usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { CollapsibleSidebarShell } from '@/components/shared/CollapsibleWorkspace'
import type { PermissionCenterRole, PermissionMenuId } from '@/types/permissionCenter'
import PolicyEditor from '@/components/permission-center/PolicyEditor'
import RoleForm from '@/components/permission-center/RoleForm'
import styles from '@/components/permission-center/PermissionCenter.module.css'

export default function PermissionCenter() {
  const model = usePermissionStore(state => state.permissionCenter)
  const actor = useProjectStore(state => state.currentLoginUser)
  const permission = useMenuPermission(actor, 'permission.center')
  const [roleId, setRoleId] = useState(SUPER_ADMIN_ROLE_ID)
  const [menuId, setMenuId] = useState<PermissionMenuId>('project.view')
  const [roleSearch, setRoleSearch] = useState('')
  const [menuSearch, setMenuSearch] = useState('')
  const [roleCollapsed, setRoleCollapsed] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [roleExpanded, setRoleExpanded] = useState<Key[]>(() => model?.groups.map(group => group.id) ?? [])
  const [menuExpanded, setMenuExpanded] = useState<Key[]>(() => [...new Set(PERMISSION_MENUS.map(menu => menu.category))])
  const [formRole, setFormRole] = useState<PermissionCenterRole | 'new' | null>(null)
  const [conditionDirty, setConditionDirty] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const setDraft = useUiStore(state => state.setPermissionCenterHasDraft)
  const onConditionDirty = useCallback((dirty: boolean) => setConditionDirty(dirty), [])
  useEffect(() => { setDraft(conditionDirty || formDirty) }, [conditionDirty, formDirty, setDraft])
  useEffect(() => () => setDraft(false), [setDraft])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const adapt = () => { setNarrow(media.matches); if (media.matches) setRoleCollapsed(true) }
    adapt(); media.addEventListener('change', adapt)
    return () => media.removeEventListener('change', adapt)
  }, [])
  const role = model?.roles.find(role => role.id === roleId) ?? model?.roles[0]
  const menu = PERMISSION_MENUS.find(menu => menu.id === menuId)
  const navigate = (action: () => void) => useUiStore.getState().navigateWithEditGuard(() => {
    setConditionDirty(false); setFormDirty(false); setDraft(false); setEditorEpoch(value => value + 1); action()
  }, false)
  if (!model || !permission.can('manage')) return <Empty description="没有权限中心管理权限" />
  const title = (label: string) => <Tooltip title={label} placement="right"><span className={styles.node}>{label}</span></Tooltip>
  const roleTree: DataNode[] = model.groups.flatMap(group => {
    const roles = model.roles.filter(role => role.groupId === group.id && `${group.name} ${role.name}`.toLowerCase().includes(roleSearch.toLowerCase()))
    return roles.length ? [{ key: group.id, title: title(group.name), selectable: false, children: roles.map(role => ({ key: role.id, title: title(role.name), isLeaf: true })) }] : []
  })
  const categories = [...new Set(PERMISSION_MENUS.map(menu => menu.category))]
  const menuTree: DataNode[] = categories.flatMap(category => {
    const menus = PERMISSION_MENUS.filter(menu => menu.category === category && `${category} ${menu.label}`.toLowerCase().includes(menuSearch.toLowerCase()))
    return menus.length ? [{ key: category, title: title(category), selectable: false, children: menus.map(menu => ({ key: menu.id, title: title(menu.label), isLeaf: true })) }] : []
  })
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
  return <section className={styles.workspace} aria-label="权限中心">
    <div className={styles.mobileSelectors}>
      <Button aria-expanded={!roleCollapsed} onClick={() => setRoleCollapsed(value => !value)}>选择角色</Button>
    </div>
    <CollapsibleSidebarShell className={styles.sidebar} collapsed={roleCollapsed} onCollapsedChange={setRoleCollapsed} title="角色分组" ariaLabel="角色侧栏"
      expandedWidth={180} collapsedWidth={40} expandLabel="展开角色侧栏" collapseLabel="收起角色侧栏">
      <Input className={styles.search} prefix={<SearchOutlined />} placeholder="搜索角色" aria-label="搜索角色" value={roleSearch} onChange={event => setRoleSearch(event.target.value)} allowClear />
      <Button className={styles.addRole} icon={<PlusOutlined />} onClick={() => navigate(() => setFormRole('new'))}>添加角色</Button>
      {roleTree.length ? <Tree blockNode treeData={roleTree} selectedKeys={role ? [role.id] : []} expandedKeys={roleSearch ? roleTree.map(node => node.key) : roleExpanded}
        onClick={(_, node) => { if (!node.isLeaf) setRoleExpanded(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key]) }}
        onExpand={setRoleExpanded} onSelect={keys => { const selected = model.roles.find(role => role.id === keys[0]); if (selected) navigate(() => { setRoleId(selected.id); if (narrow) setRoleCollapsed(true) }) }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到角色" />}
    </CollapsibleSidebarShell>
    <div className={styles.content}>
      {role ? <><div className={styles.roleHeader}><div className={styles.roleCopy}><div className={styles.roleTitle}>{role.name}</div>
        <div className={styles.muted}>{model.groups.find(group => group.id === role.groupId)?.name}</div>
        {role.description && <div className={`${styles.muted} ${styles.description}`}>{role.description}</div>}
      </div>{role.id !== SUPER_ADMIN_ROLE_ID && <Space><Button icon={<EditOutlined />} onClick={() => navigate(() => setFormRole(role))}>编辑</Button><Button danger icon={<DeleteOutlined />} onClick={deleteRole}>删除</Button></Space>}</div>
        <div className={styles.configurationBody}>
          <nav className={styles.menuNavigation} aria-label="功能菜单">
            <div className={styles.menuNavigationTitle}>功能菜单</div>
            <Input className={styles.search} prefix={<SearchOutlined />} placeholder="搜索菜单" aria-label="搜索菜单" value={menuSearch} onChange={event => setMenuSearch(event.target.value)} allowClear />
            <div className={styles.menuTree}>
              {menuTree.length ? <Tree blockNode treeData={menuTree} selectedKeys={[menuId]} expandedKeys={menuSearch ? menuTree.map(node => node.key) : menuExpanded}
                onClick={(_, node) => { if (!node.isLeaf) setMenuExpanded(previous => previous.includes(node.key) ? previous.filter(key => key !== node.key) : [...previous, node.key]) }}
                onExpand={setMenuExpanded} onSelect={keys => { const selected = PERMISSION_MENUS.find(menu => menu.id === keys[0]); if (selected) navigate(() => setMenuId(selected.id)) }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到菜单" />}
            </div>
          </nav>
          <div className={styles.policyPane}>
            {menu ? <PolicyEditor key={`${actor}:${role.id}:${menu.id}:${editorEpoch}`} actor={actor} model={model} role={role} menu={menu} onDirtyChange={onConditionDirty} /> : <Empty description="请选择功能菜单" />}
          </div>
        </div>
      </> : <Empty description="暂无角色，请先添加角色" />}
    </div>
    {formRole && <RoleForm model={model} role={formRole === 'new' ? undefined : formRole} onDirty={() => setFormDirty(true)} onClose={closeForm}
      onSubmit={input => {
        const store = usePermissionStore.getState()
        const result = formRole === 'new' ? store.createCenterRole(actor, input) : store.updateCenterRole(actor, formRole.id, input)
        if (result.ok) {
          setFormDirty(false); setDraft(false); setFormRole(null); setRoleSearch(''); setRoleCollapsed(false)
          if (result.roleId) {
            setRoleId(result.roleId)
            const group = usePermissionStore.getState().permissionCenter?.roles.find(role => role.id === result.roleId)?.groupId
            if (group) setRoleExpanded(previous => [...new Set([...previous, group])])
          }
        }
        return result
      }} />}
  </section>
}
