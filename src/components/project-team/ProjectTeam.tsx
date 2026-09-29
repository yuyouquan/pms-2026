'use client'

import { useState } from 'react'
import { Button, Empty, Input, Space, Table, Tag, Tooltip, Tree, message } from 'antd'
import { ReloadOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useProjectTeamStore } from '@/stores/projectTeam'
import { projectTeamRows } from '@/lib/projectTeamPresentation'
import type { ProjectTeamMember } from '@/types/projectTeam'
import styles from '@/components/project-team/ProjectTeam.module.css'

export default function ProjectTeam({ projectId }: { projectId: string }) {
  const team = useProjectTeamStore(state => state.teamsByProjectId[projectId])
  const refreshMock = useProjectTeamStore(state => state.refreshMock)
  const [roleSearch, setRoleSearch] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [feedback, contextHolder] = message.useMessage()
  const members = projectTeamRows(team)
  const roles = [...new Set([...(team?.roles || []), ...members.flatMap(member => member.roles)])]
  const shownRoles = roles.filter(role => role.toLocaleLowerCase().includes(roleSearch.trim().toLocaleLowerCase()))
  const query = memberSearch.trim().toLocaleLowerCase()
  const rows = members.filter(member => (!selectedRole || member.roles.includes(selectedRole))
    && [member.name, member.employeeId, member.department, member.email, member.valueDelivery, ...member.roles].join(' ').toLocaleLowerCase().includes(query))
  const text = (value: string) => <Tooltip title={value || undefined}><span className={styles.cell}>{value || '—'}</span></Tooltip>
  const empty = !team ? '暂无 IPM Mock 团队来源' : !members.length ? '当前团队暂无成员' : selectedRole && !members.some(member => member.roles.includes(selectedRole)) ? '当前角色暂无成员' : '没有匹配的成员'
  return <section className={styles.root} aria-label="项目团队">
    {contextHolder}
    <div className={styles.heading}><Space><strong>项目团队</strong><Tag>IPM Mock</Tag><span className={styles.muted}>{members.length} 位成员</span></Space><Button size="small" icon={<ReloadOutlined />} onClick={() => { refreshMock(); void feedback.success('已重新读取本地 Mock 团队') }}>刷新</Button></div>
    <p className={styles.note}>团队来源为本地 IPM Mock，仅供查看。团队成员固定只读，额外项目角色、部门授权和职责不会增加操作权限；系统超级管理员除外。</p>
    <div className={`${styles.layout} ${collapsed ? styles.collapsed : ''}`}>
      <aside className={styles.sidebar} aria-label="团队角色">
        <div className={styles.roleHeading}>{!collapsed && <strong>角色</strong>}<Button type="text" size="small" aria-label={collapsed ? '展开角色栏' : '收起角色栏'} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} /></div>
        {!collapsed && <><Input size="small" aria-label="搜索团队角色" placeholder="搜索角色" allowClear value={roleSearch} onChange={event => setRoleSearch(event.target.value)} /><Tree blockNode selectedKeys={[selectedRole === null ? '__all__' : `role:${selectedRole}`]} expandedKeys={expanded ? ['__all__'] : []} onExpand={keys => setExpanded(keys.includes('__all__'))} onSelect={keys => { const key = String(keys[0] || '__all__'); setSelectedRole(key === '__all__' ? null : key.slice(5)) }} treeData={[{ key: '__all__', title: `全部角色（${members.length}）`, children: shownRoles.map(role => ({ key: `role:${role}`, title: <Tooltip title={role}><span className={styles.roleName}>{role}（{members.filter(member => member.roles.includes(role)).length}）</span></Tooltip> })) }]} />{!shownRoles.length && <span className={styles.muted}>{roleSearch ? '没有匹配的角色' : '暂无角色'}</span>}</>}
      </aside>
      <div className={styles.content}>
        <div className={styles.toolbar}><Tooltip title={selectedRole || '全部成员'}><strong className={styles.selection}>{selectedRole || '全部成员'}（{rows.length}）</strong></Tooltip><Input size="small" aria-label="搜索团队成员" placeholder="搜索姓名、工号、角色等" allowClear value={memberSearch} onChange={event => setMemberSearch(event.target.value)} /></div>
        <Table<ProjectTeamMember> className="pms-table" size="small" rowKey="employeeId" dataSource={rows} scroll={{ x: 1000 }} pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} /> }} columns={[
          { title: '姓名', dataIndex: 'name', width: 120, render: text },
          { title: '工号', dataIndex: 'employeeId', width: 140, render: text },
          { title: '角色', dataIndex: 'roles', width: 180, render: (values: readonly string[]) => text(values.join(' / ')) },
          { title: '直属部门', dataIndex: 'department', width: 160, render: text },
          { title: '邮箱', dataIndex: 'email', width: 220, render: text },
          { title: '价值交付', dataIndex: 'valueDelivery', width: 220, render: text },
        ]} />
      </div>
    </div>
  </section>
}
