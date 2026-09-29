'use client'

import { useMemo, useState } from 'react'
import { Empty, Input, Space, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getProjectTeamRoleMembers } from '@/lib/projectTeam'
import { useProjectTeamStore } from '@/stores/projectTeam'
import type { ProjectTeamMember } from '@/types/projectTeam'

interface Props { projectId: string; ipmRoleCode: string; roleName: string }
const show = (value: string) => value || '—'
export default function ProjectTeamMembers({ projectId, ipmRoleCode, roleName }: Props) {
  const [query, setQuery] = useState('')
  const team = useProjectTeamStore(state => state.teamsByProjectId[projectId])
  const members = useMemo(() => [...new Map(getProjectTeamRoleMembers(projectId, ipmRoleCode).map(member => [member.employeeId, member])).values()], [projectId, ipmRoleCode, team])
  const rows = members.filter(member => `${member.name} ${member.employeeId} ${member.department} ${member.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <section aria-label="来源角色人员列表">
    <Space style={{ marginBottom: 10 }}><Input prefix={<SearchOutlined />} aria-label="搜索团队成员" placeholder="搜索姓名、工号、部门或邮箱" value={query} allowClear onChange={event => setQuery(event.target.value)} /><span style={{ color: '#717680', fontSize: 12 }}>共 {rows.length} 位成员 · IPM 同步，只读</span></Space>
    <Table<ProjectTeamMember> className="pms-table" size="small" rowKey="employeeId" dataSource={rows} pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 960 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? '没有匹配的成员' : '当前角色暂无成员'} /> }} columns={[
      { title: 'No.', key: 'number', width: 64, render: (_value, _row, index) => index + 1 },
      { title: '成员名称', dataIndex: 'name', key: 'name', width: 120, sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'), filters: [...new Set(members.map(member => member.name))].map(name => ({ text: name, value: name })), onFilter: (value, member) => member.name === value, render: show },
      { title: '工号', dataIndex: 'employeeId', key: 'employeeId', width: 130, sorter: (a, b) => a.employeeId.localeCompare(b.employeeId), render: show },
      { title: '角色', key: 'role', width: 130, render: () => roleName },
      { title: '价值交付', dataIndex: 'valueDelivery', key: 'valueDelivery', width: 180, render: show },
      { title: '直属部门', dataIndex: 'department', key: 'department', width: 150, render: show },
      { title: '人员邮箱', dataIndex: 'email', key: 'email', width: 220, render: show },
    ]} />
  </section>
}
