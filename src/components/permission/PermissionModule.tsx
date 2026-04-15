'use client'

import React from 'react'
import { Card, Tabs, Table, Button, Space, Input, Select, Tag, Modal, Form, Popconfirm, Checkbox, Empty, message } from 'antd'
import { TeamOutlined, SafetyCertificateOutlined, PlusOutlined } from '@ant-design/icons'

// ========== Constants ==========

export const FIXED_ROLES = ['系统管理员', '产品经理', '项目经理', '开发代表', '软件SE', '设计师', '开发工程师', '测试工程师', '管理层']

export const ALL_USERS = ['张三', '李四', '王五', '赵六', '孙七', '周八', '李白', '杜甫']

export const PERMISSION_MODULES = [
  { key: 'basicInfo', name: '基础信息', permissions: ['查看', '编辑'] },
  { key: 'requirements', name: '需求', permissions: [] as string[] },
  { key: 'plan', name: '计划', permissions: ['一级计划-查看', '一级计划-编辑', '一级计划-审核', '二级计划-查看', '二级计划-编辑', '导入/导出'] },
  { key: 'resources', name: '资源', permissions: ['查看'] },
  { key: 'tasks', name: '任务', permissions: ['查看'] },
  { key: 'risks', name: '风险', permissions: ['查看'] },
]

export const GLOBAL_PERM_OPTIONS = [
  { key: 'roadmap:view', module: '项目路标', name: '查看' },
  { key: 'roadmap:edit', module: '项目路标', name: '编辑' },
  { key: 'roadmap:baseline', module: '项目路标', name: '基线' },
  { key: 'roadmap:export', module: '项目路标', name: '导出' },
  { key: 'viewBoard:placeholder', module: '视图看板', name: '' },
  { key: 'resourceMgmt:placeholder', module: '资源管理', name: '' },
  { key: 'configCenter:placeholder', module: '配置中心', name: '' },
]

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
}) => {
  const handleAddRole = () => {
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
    setRoles(roles.filter(r => r.name !== roleName))
    setRolePermissions(prev => { const next = { ...prev }; delete next[roleName]; return next })
    if (permissionActiveRole === roleName) setPermissionActiveRole(roles[0]?.name || '系统管理员')
    message.success('角色已删除')
  }
  const handleRenameRole = (oldName: string) => {
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
    setRoles(roles.map(r => r.name === roleName ? { ...r, members } : r))
  }
  const handlePermToggle = (roleName: string, permKey: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleName]: { ...prev[roleName], [permKey]: !prev[roleName]?.[permKey] }
    }))
  }

  return (
    <Card style={{ borderRadius: 8 }}>
      <Tabs activeKey={permConfigTab} onChange={(k) => setPermConfigTab(k as any)} items={[
        { key: 'roles', label: <Space><TeamOutlined />角色人员配置</Space> },
        { key: 'perms', label: <Space><SafetyCertificateOutlined />权限配置</Space> },
      ]} />

      {permConfigTab === 'roles' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#4b5563' }}>共 {roles.length} 个角色（{FIXED_ROLES.length} 个固定角色）</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddRoleModal(true)}>新增角色</Button>
          </div>
          <Table
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
                        <Input size="small" value={editRoleNameValue} onChange={e => setEditRoleNameValue(e.target.value)} onPressEnter={() => handleRenameRole(name)} style={{ width: 120 }} />
                        <Button size="small" type="link" onClick={() => handleRenameRole(name)}>确定</Button>
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
                title: '操作', width: 120,
                render: (_: any, record: any) => record.isFixed ? (
                  <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
                ) : (
                  <Space>
                    <Button type="link" size="small" onClick={() => { setEditingRoleName(record.name); setEditRoleNameValue(record.name) }}>重命名</Button>
                    <Popconfirm title="确定删除该角色？" onConfirm={() => handleDeleteRole(record.name)}>
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                )
              },
            ]}
          />
          <Modal title="新增角色" open={showAddRoleModal} onCancel={() => { setShowAddRoleModal(false); setNewRoleName('') }} onOk={handleAddRole} okText="确定" cancelText="取消">
            <Form layout="vertical">
              <Form.Item label="角色名称" required>
                <Input placeholder="请输入角色名称" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onPressEnter={handleAddRole} />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )}

      {permConfigTab === 'perms' && (
        <div>
          <Tabs
            activeKey={permissionActiveRole}
            onChange={setPermissionActiveRole}
            type="card"
            size="small"
            style={{ marginBottom: 16 }}
            items={roles.map(r => ({ key: r.name, label: r.name }))}
          />
          <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
              角色权限配置 — {permissionActiveRole}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {PERMISSION_MODULES.map((mod) => {
                  const perms = mod.permissions
                  const maxCols = 6
                  return (
                    <tr key={mod.key}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 14, borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', width: 100, background: '#f8fafc', verticalAlign: 'middle' }}>{mod.name}</td>
                      {perms.length > 0 ? (
                        <>
                          {perms.map(p => (
                            <td key={p} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', minWidth: 110 }}>
                              <div style={{ fontSize: 13, marginBottom: 6 }}>{p}</div>
                              <Checkbox checked={!!rolePermissions[permissionActiveRole]?.[`${mod.key}:${p}`]} onChange={() => handlePermToggle(permissionActiveRole, `${mod.key}:${p}`)} />
                            </td>
                          ))}
                          {perms.length < maxCols && Array.from({ length: maxCols - perms.length }).map((_, i) => (
                            <td key={`empty-${i}`} style={{ borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }} />
                          ))}
                        </>
                      ) : (
                        <td colSpan={maxCols} style={{ borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }} />
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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

  return (
    <Card style={{ borderRadius: 8 }}>
      <Tabs activeKey={globalPermTab} onChange={(k) => setGlobalPermTab(k as any)} items={[
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
            <>
              <Tabs
                activeKey={globalPermActiveRole}
                onChange={setGlobalPermActiveRole}
                type="card"
                size="small"
                style={{ marginBottom: 16 }}
                items={globalRoles.map(r => ({ key: r.name, label: r.name }))}
              />
              <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: 14, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
                  角色权限配置 — {globalPermActiveRole}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {(() => {
                      // 按 module 分组
                      const modules: { module: string; perms: typeof GLOBAL_PERM_OPTIONS }[] = []
                      GLOBAL_PERM_OPTIONS.forEach(opt => {
                        const last = modules[modules.length - 1]
                        if (last && last.module === opt.module) {
                          last.perms.push(opt)
                        } else {
                          modules.push({ module: opt.module, perms: [opt] })
                        }
                      })
                      const maxCols = Math.max(...modules.map(m => m.perms.filter(p => p.name).length), 4)
                      return modules.map(mod => {
                        const realPerms = mod.perms.filter(p => p.name)
                        return (
                          <tr key={mod.module}>
                            <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 14, borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', width: 140, background: '#f8fafc', verticalAlign: 'middle' }}>{mod.module}</td>
                            {realPerms.map(opt => (
                              <td key={opt.key} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', minWidth: 110 }}>
                                <div style={{ fontSize: 13, marginBottom: 6 }}>{opt.name}</div>
                                <Checkbox checked={!!globalRolePerms[globalPermActiveRole]?.[opt.key]} onChange={() => handlePermToggle(globalPermActiveRole, opt.key)} />
                              </td>
                            ))}
                            {realPerms.length < maxCols && Array.from({ length: maxCols - realPerms.length }).map((_, i) => (
                              <td key={`empty-${i}`} style={{ borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }} />
                            ))}
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
