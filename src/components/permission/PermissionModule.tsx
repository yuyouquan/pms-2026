'use client'

import React from 'react'
import { Card, Tabs, Table, Button, Space, Input, Select, Tag, Modal, Form, Popconfirm, Empty, Tooltip, message } from 'antd'
import { TeamOutlined, SafetyCertificateOutlined, PlusOutlined, CheckSquareFilled, CloseOutlined } from '@ant-design/icons'
import {
  ALL_USERS,
  FIXED_ROLES,
  GLOBAL_PERMISSION_GROUPS,
  GLOBAL_PERM_OPTIONS,
  PROJECT_PERMISSION_GROUPS,
  PROJECT_PERMISSION_ITEMS,
  getProjectPermissionKeys,
} from '@/constants/permissions'

// ========== Constants ==========
export {
  ALL_USERS,
  FIXED_ROLES,
  GLOBAL_PERMISSION_GROUPS,
  GLOBAL_PERM_OPTIONS,
  PROJECT_PERMISSION_GROUPS,
  PROJECT_PERMISSION_ITEMS,
  getProjectPermissionKeys,
} from '@/constants/permissions'

// ========== Types ==========

export interface PermissionConfigProps {
  roles: { name: string; members: string[]; isFixed: boolean }[]
  setRoles: (v: { name: string; members: string[]; isFixed: boolean }[] | ((prev: { name: string; members: string[]; isFixed: boolean }[]) => { name: string; members: string[]; isFixed: boolean }[])) => void
  rolePermissions: Record<string, Record<string, boolean>>
  setRolePermissions: (v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  permConfigTab: 'roles' | 'perms'
  setPermConfigTab: (v: 'roles' | 'perms') => void
  permissionActiveRole: string
  setPermissionActiveRole: (v: string) => void
  showAddRoleModal: boolean
  setShowAddRoleModal: (v: boolean) => void
  newRoleName: string
  setNewRoleName: (v: string) => void
  editingRoleName: string | null
  setEditingRoleName: (v: string | null) => void
  editRoleNameValue: string
  setEditRoleNameValue: (v: string) => void
  projectType?: string
  onRoleMembersChange?: (roleName: string, members: string[]) => void
  syncTosTeamPermissionMembers?: (roleName: string, members: string[]) => void
  canManageRoles: boolean
}

export interface GlobalPermissionConfigProps {
  globalRoles: { name: string; members: string[]; isFixed?: boolean }[]
  setGlobalRoles: (v: { name: string; members: string[]; isFixed?: boolean }[] | ((prev: { name: string; members: string[]; isFixed?: boolean }[]) => { name: string; members: string[]; isFixed?: boolean }[])) => void
  globalRolePerms: Record<string, Record<string, boolean>>
  setGlobalRolePerms: (v: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  globalPermTab: 'roles' | 'perms'
  setGlobalPermTab: (v: 'roles' | 'perms') => void
  showGlobalAddRole: boolean
  setShowGlobalAddRole: (v: boolean) => void
  globalNewRoleName: string
  setGlobalNewRoleName: (v: string) => void
  globalEditingRole: string | null
  setGlobalEditingRole: (v: string | null) => void
  globalEditRoleValue: string
  setGlobalEditRoleValue: (v: string) => void
  globalPermActiveRole: string
  setGlobalPermActiveRole: (v: string) => void
}

// ========== PermissionConfig Component (项目空间权限配置) ==========

export const PermissionConfig: React.FC<PermissionConfigProps> = ({
  roles,
  setRoles,
  rolePermissions,
  setRolePermissions,
  permConfigTab,
  setPermConfigTab,
  permissionActiveRole,
  setPermissionActiveRole,
  showAddRoleModal,
  setShowAddRoleModal,
  newRoleName,
  setNewRoleName,
  editingRoleName,
  setEditingRoleName,
  editRoleNameValue,
  setEditRoleNameValue,
  projectType,
  onRoleMembersChange,
  syncTosTeamPermissionMembers,
  canManageRoles,
}) => {
  const handleAddRole = () => {
    if (!canManageRoles) { message.warning('无权限修改项目角色'); return }
    const name = newRoleName.trim()
    if (!name) { message.warning('请输入角色名称'); return }
    if (roles.some(r => r.name === name)) { message.warning('角色名称已存在'); return }
    setRoles([...roles, { name, members: [], isFixed: false }])
    setRolePermissions(prev => ({ ...prev, [name]: {} }))
    setNewRoleName('')
    setShowAddRoleModal(false)
    message.success('角色添加成功')
  }
  const handleDeleteRole = (roleName: string) => {
    if (!canManageRoles) { message.warning('无权限修改项目角色'); return }
    setRoles(roles.filter(r => r.name !== roleName))
    setRolePermissions(prev => { const next = { ...prev }; delete next[roleName]; return next })
    if (permissionActiveRole === roleName) setPermissionActiveRole(roles[0]?.name || '系统管理员')
    message.success('角色已删除')
  }
  const handleRenameRole = (oldName: string) => {
    if (!canManageRoles) { message.warning('无权限修改项目角色'); return }
    const newName = editRoleNameValue.trim()
    if (!newName) { message.warning('角色名称不能为空'); return }
    if (newName !== oldName && roles.some(r => r.name === newName)) { message.warning('角色名称已存在'); return }
    setRoles(roles.map(r => r.name === oldName ? { ...r, name: newName } : r))
    setRolePermissions(prev => { const next = { ...prev }; next[newName] = next[oldName]; if (newName !== oldName) delete next[oldName]; return next })
    if (permissionActiveRole === oldName) setPermissionActiveRole(newName)
    setEditingRoleName(null)
    message.success('角色名称已修改')
  }
  const handleMembersChange = (roleName: string, members: string[]) => {
    if (!canManageRoles) { message.warning('无权限修改项目角色'); return }
    if (projectType === 'tOS版本项目' && roles.find(role => role.name === roleName)?.isFixed && syncTosTeamPermissionMembers) {
      syncTosTeamPermissionMembers(roleName, members)
      return
    }
    if (onRoleMembersChange) {
      onRoleMembersChange(roleName, members)
      return
    }
    setRoles(roles.map(r => r.name === roleName ? { ...r, members } : r))
  }
  const handlePermToggle = (roleName: string, permKey: string) => {
    if (!canManageRoles) { message.warning('无权限修改项目角色'); return }
    const permission = PROJECT_PERMISSION_ITEMS.find(item => item.key === permKey)
    const permissionKeys = permission ? getProjectPermissionKeys(permission) : [permKey]
    setRolePermissions(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        ...Object.fromEntries(permissionKeys.map(key => [key, !prev[roleName]?.[permKey]])),
      },
    }))
  }
  const selectedPermissionRole = roles.some(role => role.name === permissionActiveRole) ? permissionActiveRole : roles[0]?.name
  const maxProjectPermissionColumns = Math.max(...PROJECT_PERMISSION_GROUPS.map(group => group.permissions.length))

  return (
    <Card className="pms-permission-workspace pms-solid-surface" style={{ borderRadius: 8 }}>
      <Tabs className="pms-toolbar" activeKey={permConfigTab} onChange={(k) => setPermConfigTab(k as any)} items={[
        { key: 'roles', label: <Space><TeamOutlined />角色人员配置</Space> },
        { key: 'perms', label: <Space><SafetyCertificateOutlined />权限配置</Space> },
      ]} />

      {permConfigTab === 'roles' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#4b5563' }}>共 {roles.length} 个角色（{roles.filter(role => role.isFixed).length} 个固定角色）</span>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canManageRoles} onClick={() => setShowAddRoleModal(true)}>新增角色</Button>
          </div>
          <Table
            className="pms-table"
            dataSource={roles}
            rowKey="name"
            pagination={false}
            size="middle"
            columns={[
              {
                title: '角色名称', dataIndex: 'name', width: 200,
                render: (name: string, record: any) => {
                  if (editingRoleName === name) {
                    return (
                      <Space>
                        <Input size="small" disabled={!canManageRoles} value={editRoleNameValue} onChange={e => setEditRoleNameValue(e.target.value)} onPressEnter={() => handleRenameRole(name)} style={{ width: 120 }} />
                        <Button size="small" type="link" disabled={!canManageRoles} onClick={() => handleRenameRole(name)}>确定</Button>
                        <Button size="small" type="link" onClick={() => setEditingRoleName(null)}>取消</Button>
                      </Space>
                    )
                  }
                  return (
                    <Space>
                      <span style={{ fontWeight: 500 }}>{name}</span>
                      {record.isFixed && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>固定</Tag>}
                    </Space>
                  )
                }
              },
              {
                title: '人员配置', dataIndex: 'members',
                render: (_: any, record: any) => {
                  const isTechnicalFixedRole = projectType === '技术项目' && record.isFixed
                  const memberSelect = (
                    <Select
                      mode="multiple"
                      value={record.members}
                      disabled={isTechnicalFixedRole || !canManageRoles}
                      onChange={(val: string[]) => handleMembersChange(record.name, val)}
                      style={{ width: '100%', minWidth: 300 }}
                      placeholder="请选择人员"
                      maxTagCount={5}
                      options={ALL_USERS.map(u => ({ label: u, value: u }))}
                    />
                  )
                  return isTechnicalFixedRole
                    ? <Tooltip title="请在项目团队信息中维护"><span>{memberSelect}</span></Tooltip>
                    : memberSelect
                }
              },
              {
                title: '操作', width: 120,
                render: (_: any, record: any) => record.isFixed ? (
                  <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
                ) : (
                  <Space>
                    <Button type="link" size="small" disabled={!canManageRoles} onClick={() => { setEditingRoleName(record.name); setEditRoleNameValue(record.name) }}>重命名</Button>
                    <Popconfirm title="确定删除该角色？" disabled={!canManageRoles} onConfirm={() => handleDeleteRole(record.name)}>
                      <Button type="link" size="small" danger disabled={!canManageRoles}>删除</Button>
                    </Popconfirm>
                  </Space>
                )
              },
            ]}
          />
          <Modal title="新增角色" open={showAddRoleModal} onCancel={() => { setShowAddRoleModal(false); setNewRoleName('') }} onOk={handleAddRole} okText="确定" cancelText="取消" okButtonProps={{ disabled: !canManageRoles }}>
            <Form layout="vertical">
              <Form.Item label="角色名称" required>
                <Input placeholder="请输入角色名称" disabled={!canManageRoles} value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onPressEnter={handleAddRole} />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )}

      {permConfigTab === 'perms' && (
        <div>
          {roles.length === 0 ? (
            <Empty description="请先添加角色" style={{ padding: '40px 0' }} />
          ) : (
            <div>
              <Tabs
                activeKey={selectedPermissionRole}
                onChange={setPermissionActiveRole}
                type="card"
                size="small"
                style={{ marginBottom: 16 }}
                items={roles.map(role => ({ key: role.name, label: role.name }))}
              />
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
                <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  角色权限配置 — {selectedPermissionRole}
                </div>
                <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    {PROJECT_PERMISSION_GROUPS.map(group => (
                      <tr key={group.module}>
                        <td style={{ width: 130, padding: '18px 16px', fontWeight: 600, fontSize: 14, color: '#1f2937', borderRight: '1px solid #edf0f5', borderBottom: '1px solid #edf0f5', background: '#fbfcff', verticalAlign: 'middle' }}>
                          {group.module}
                        </td>
                        {group.permissions.map(permission => {
                          const enabled = !!rolePermissions[selectedPermissionRole]?.[permission.key]
                          return (
                            <td
                              key={`${selectedPermissionRole}-${permission.key}`}
                              style={{
                                padding: '16px 14px',
                                textAlign: 'center',
                                borderRight: '1px solid #edf0f5',
                                borderBottom: '1px solid #edf0f5',
                                background: '#fff',
                                minWidth: 120,
                              }}
                            >
                              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4, minHeight: 20, marginBottom: 8 }}>{permission.name}</div>
                              <button
                                type="button"
                                disabled={!canManageRoles}
                                aria-label={`${selectedPermissionRole}-${group.module}-${permission.name}-${enabled ? '已启用' : '未启用'}`}
                                onClick={() => handlePermToggle(selectedPermissionRole, permission.key)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  cursor: canManageRoles ? 'pointer' : 'not-allowed',
                                  opacity: canManageRoles ? 1 : 0.55,
                                  lineHeight: 1,
                                }}
                              >
                                {enabled ? (
                                  <CheckSquareFilled style={{ color: '#1677ff', fontSize: 17 }} />
                                ) : (
                                  <CloseOutlined style={{ color: '#ff0000', fontSize: 16, fontWeight: 700 }} />
                                )}
                              </button>
                            </td>
                          )
                        })}
                        {group.permissions.length < maxProjectPermissionColumns && (
                          <td
                            colSpan={maxProjectPermissionColumns - group.permissions.length + 1}
                            style={{
                              borderRight: '1px solid #edf0f5',
                              borderBottom: '1px solid #edf0f5',
                              background: '#fff',
                            }}
                          />
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ========== GlobalPermissionConfig Component (全局权限配置) ==========

export const GlobalPermissionConfig: React.FC<GlobalPermissionConfigProps> = ({
  globalRoles,
  setGlobalRoles,
  globalRolePerms,
  setGlobalRolePerms,
  globalPermTab,
  setGlobalPermTab,
  showGlobalAddRole,
  setShowGlobalAddRole,
  globalNewRoleName,
  setGlobalNewRoleName,
  globalEditingRole,
  setGlobalEditingRole,
  globalEditRoleValue,
  setGlobalEditRoleValue,
  globalPermActiveRole,
  setGlobalPermActiveRole,
}) => {
  const handleAddRole = () => {
    const name = globalNewRoleName.trim()
    if (!name) { message.warning('请输入角色名称'); return }
    if (globalRoles.some(r => r.name === name)) { message.warning('角色名称已存在'); return }
    setGlobalRoles([...globalRoles, { name, members: [] }])
    setGlobalRolePerms(prev => ({ ...prev, [name]: {} }))
    setGlobalNewRoleName('')
    setShowGlobalAddRole(false)
    message.success('角色添加成功')
  }
  const handleDeleteRole = (roleName: string) => {
    setGlobalRoles(globalRoles.filter(r => r.name !== roleName))
    setGlobalRolePerms(prev => { const next = { ...prev }; delete next[roleName]; return next })
    if (globalPermActiveRole === roleName) setGlobalPermActiveRole(globalRoles.filter(r => r.name !== roleName)[0]?.name || '')
    message.success('角色已删除')
  }
  const handleRenameRole = (oldName: string) => {
    const newName = globalEditRoleValue.trim()
    if (!newName) { message.warning('角色名称不能为空'); return }
    if (newName !== oldName && globalRoles.some(r => r.name === newName)) { message.warning('角色名称已存在'); return }
    setGlobalRoles(globalRoles.map(r => r.name === oldName ? { ...r, name: newName } : r))
    setGlobalRolePerms(prev => { const next = { ...prev }; next[newName] = next[oldName]; if (newName !== oldName) delete next[oldName]; return next })
    if (globalPermActiveRole === oldName) setGlobalPermActiveRole(newName)
    setGlobalEditingRole(null)
    message.success('角色名称已修改')
  }
  const handleMembersChange = (roleName: string, members: string[]) => {
    setGlobalRoles(globalRoles.map(r => r.name === roleName ? { ...r, members } : r))
  }
  const handlePermToggle = (roleName: string, permKey: string) => {
    setGlobalRolePerms(prev => ({
      ...prev,
      [roleName]: { ...prev[roleName], [permKey]: !prev[roleName]?.[permKey] }
    }))
  }
  const selectedGlobalPermissionRole = globalRoles.some(role => role.name === globalPermActiveRole) ? globalPermActiveRole : globalRoles[0]?.name
  const maxGlobalPermissionColumns = Math.max(...GLOBAL_PERMISSION_GROUPS.map(group => group.permissions.length))

  return (
    <Card className="pms-permission-workspace pms-solid-surface" style={{ borderRadius: 8 }}>
      <Tabs className="pms-toolbar" activeKey={globalPermTab} onChange={(k) => setGlobalPermTab(k as any)} items={[
        { key: 'roles', label: <Space><TeamOutlined />角色配置</Space> },
        { key: 'perms', label: <Space><SafetyCertificateOutlined />权限配置</Space> },
      ]} />

      {globalPermTab === 'roles' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#4b5563' }}>共 {globalRoles.length} 个角色</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowGlobalAddRole(true)}>新增角色</Button>
          </div>
          <Table
            className="pms-table"
            dataSource={globalRoles}
            rowKey="name"
            pagination={false}
            size="middle"
            columns={[
              {
                title: '角色名称', dataIndex: 'name', width: 200,
                render: (name: string) => {
                  if (globalEditingRole === name) {
                    return (
                      <Space>
                        <Input size="small" value={globalEditRoleValue} onChange={e => setGlobalEditRoleValue(e.target.value)} onPressEnter={() => handleRenameRole(name)} style={{ width: 120 }} />
                        <Button size="small" type="link" onClick={() => handleRenameRole(name)}>确定</Button>
                        <Button size="small" type="link" onClick={() => setGlobalEditingRole(null)}>取消</Button>
                      </Space>
                    )
                  }
                  return <span style={{ fontWeight: 500 }}>{name}</span>
                }
              },
              {
                title: '人员配置', dataIndex: 'members',
                render: (_: any, record: any) => (
                  <Select
                    mode="multiple"
                    value={record.members}
                    onChange={(val: string[]) => handleMembersChange(record.name, val)}
                    style={{ width: '100%', minWidth: 300 }}
                    placeholder="请选择人员"
                    maxTagCount={5}
                    options={ALL_USERS.map(u => ({ label: u, value: u }))}
                  />
                )
              },
              {
                title: '操作', width: 150,
                render: (_: any, record: any) => (
                  record.isFixed ? (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>固定角色</span>
                  ) : (
                    <Space>
                      <Button type="link" size="small" onClick={() => { setGlobalEditingRole(record.name); setGlobalEditRoleValue(record.name) }}>重命名</Button>
                      <Popconfirm title="确定删除该角色？" onConfirm={() => handleDeleteRole(record.name)}>
                        <Button type="link" size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )
                )
              },
            ]}
          />
          <Modal title="新增角色" open={showGlobalAddRole} onCancel={() => { setShowGlobalAddRole(false); setGlobalNewRoleName('') }} onOk={handleAddRole} okText="确定" cancelText="取消">
            <Form layout="vertical">
              <Form.Item label="角色名称" required>
                <Input placeholder="请输入角色名称" value={globalNewRoleName} onChange={e => setGlobalNewRoleName(e.target.value)} onPressEnter={handleAddRole} />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )}

      {globalPermTab === 'perms' && (
        <div>
          {globalRoles.length === 0 ? (
            <Empty description="请先添加角色" style={{ padding: '40px 0' }} />
          ) : (
            <div>
              <Tabs
                activeKey={selectedGlobalPermissionRole}
                onChange={setGlobalPermActiveRole}
                type="card"
                size="small"
                style={{ marginBottom: 16 }}
                items={globalRoles.map(role => ({ key: role.name, label: role.name }))}
              />
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
                <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  角色权限配置 — {selectedGlobalPermissionRole}
                </div>
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    {GLOBAL_PERMISSION_GROUPS.map(group => (
                      <tr key={group.module}>
                        <td style={{ width: 130, padding: '18px 16px', fontWeight: 600, fontSize: 14, color: '#1f2937', borderRight: '1px solid #edf0f5', borderBottom: '1px solid #edf0f5', background: '#fbfcff', verticalAlign: 'middle' }}>
                          {group.module}
                        </td>
                        {group.permissions.map(permission => {
                          const enabled = !!globalRolePerms[selectedGlobalPermissionRole]?.[permission.key]
                          return (
                            <td
                              key={`${selectedGlobalPermissionRole}-${permission.key}`}
                              style={{
                                padding: '16px 14px',
                                textAlign: 'center',
                                borderRight: '1px solid #edf0f5',
                                borderBottom: '1px solid #edf0f5',
                                background: '#fff',
                                minWidth: 120,
                              }}
                            >
                              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4, minHeight: 20, marginBottom: 8 }}>{permission.name}</div>
                              <button
                                type="button"
                                aria-label={`${selectedGlobalPermissionRole}-${group.module}-${permission.name}-${enabled ? '已启用' : '未启用'}`}
                                onClick={() => handlePermToggle(selectedGlobalPermissionRole, permission.key)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  cursor: 'pointer',
                                  lineHeight: 1,
                                }}
                              >
                                {enabled ? (
                                  <CheckSquareFilled style={{ color: '#1677ff', fontSize: 17 }} />
                                ) : (
                                  <CloseOutlined style={{ color: '#ff0000', fontSize: 16, fontWeight: 700 }} />
                                )}
                              </button>
                            </td>
                          )
                        })}
                        {group.permissions.length < maxGlobalPermissionColumns && (
                          <td
                            colSpan={maxGlobalPermissionColumns - group.permissions.length}
                            style={{
                              borderRight: '1px solid #edf0f5',
                              borderBottom: '1px solid #edf0f5',
                              background: '#fff',
                            }}
                          />
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
